import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CardStatus } from '@/generated/prisma/enums'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// Terminal column name → CardStatus mapping
// ---------------------------------------------------------------------------
const TERMINAL_COLUMN_STATUS: Record<string, CardStatus> = {
  done: CardStatus.DONE,
  cancelled: CardStatus.CANCELLED,
  canceled: CardStatus.CANCELLED,
}

/**
 * Derive a CardStatus from a column name if it matches a known terminal state.
 * Returns null if the column name does not match any terminal state.
 * Uses Object.hasOwn to avoid prototype-chain pollution (e.g. "__proto__").
 */
function terminalStatusForColumn(columnName: string): CardStatus | null {
  const key = columnName.trim().toLowerCase()
  return Object.hasOwn(TERMINAL_COLUMN_STATUS, key) ? TERMINAL_COLUMN_STATUS[key] : null
}

// ---------------------------------------------------------------------------
// Position rebalancing
// When the gap between any two adjacent positions in a column falls below
// 0.001, renumber all positions in that column as integers 1, 2, 3, ...
// This runs inside the same transaction as the card move.
// ---------------------------------------------------------------------------
async function rebalanceColumnIfNeeded(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  columnId: string,
): Promise<void> {
  // Fetch all non-archived cards in the column ordered by position
  const cards = await tx.card.findMany({
    where: { columnId, isArchived: false },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  })

  if (cards.length < 2) return

  // Check whether any adjacent gap is below the threshold
  let needsRebalance = false
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].position - cards[i - 1].position < 0.001) {
      needsRebalance = true
      break
    }
  }

  if (!needsRebalance) return

  // Renumber as 1, 2, 3, ...
  for (let i = 0; i < cards.length; i++) {
    await tx.card.update({
      where: { id: cards[i].id },
      data: { position: i + 1 },
    })
  }
}

// ---------------------------------------------------------------------------
// POST /api/cards/[id]/move
// Body: { columnId: string, position: number }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify card exists and user owns the parent board
  const card = await prisma.card.findUnique({
    where: { id },
    include: {
      board: { select: { userId: true } },
    },
  })
  if (!card) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (card.board.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse and validate request body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const fields: Record<string, string> = {}

  if (typeof input.columnId !== 'string' || input.columnId.trim() === '') {
    fields.columnId = 'columnId must be a non-empty string'
  }

  if (typeof input.position !== 'number' || !isFinite(input.position)) {
    fields.position = 'position must be a finite number'
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  const targetColumnId = (input.columnId as string).trim()
  const targetPosition = input.position as number

  // Verify destination column exists and belongs to the same board
  const destColumn = await prisma.column.findUnique({
    where: { id: targetColumnId },
    include: {
      board: { select: { id: true, userId: true } },
      _count: { select: { cards: { where: { isArchived: false } } } },
    },
  })
  if (!destColumn) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (destColumn.board.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (destColumn.board.id !== card.boardId) {
    return Response.json(
      {
        error: 'Validation failed',
        fields: { columnId: 'Destination column must be on the same board' },
      },
      { status: 422 },
    )
  }

  // Enforce WIP limit on destination column.
  // If the card is already in the destination column, the count won't change —
  // only enforce when moving to a different column.
  const isMovingToNewColumn = targetColumnId !== card.columnId
  if (
    isMovingToNewColumn &&
    destColumn.cardLimit !== null &&
    destColumn._count.cards >= destColumn.cardLimit
  ) {
    return Response.json(
      {
        error: 'Validation failed',
        fields: {
          columnId: `Column WIP limit of ${destColumn.cardLimit} has been reached`,
        },
      },
      { status: 422 },
    )
  }

  // Determine new CardStatus based on destination column name
  const newStatus = terminalStatusForColumn(destColumn.name)

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Build the update payload
      const updateData: {
        columnId: string
        position: number
        status?: CardStatus
      } = {
        columnId: targetColumnId,
        position: targetPosition,
      }

      if (newStatus !== null) {
        updateData.status = newStatus
      }

      const movedCard = await tx.card.update({
        where: { id },
        data: updateData,
      })

      // Rebalance positions in the destination column if gaps are too small
      await rebalanceColumnIfNeeded(tx, targetColumnId)

      // If the card moved out of its source column, also rebalance the source
      if (isMovingToNewColumn) {
        await rebalanceColumnIfNeeded(tx, card.columnId)
      }

      return movedCard
    })

    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
