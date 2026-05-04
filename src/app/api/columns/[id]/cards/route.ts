import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// POST /api/columns/[id]/cards — create a card at the end of the column
// Body: { title: string }
// Enforces WIP limit: if column.cardLimit is set and current non-archived
// card count >= cardLimit, returns 422.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: columnId } = await ctx.params

  // Verify column exists and user owns the parent board
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: {
      board: { select: { id: true, userId: true } },
      _count: { select: { cards: { where: { isArchived: false } } } },
    },
  })
  if (!column) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (column.board.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Enforce WIP limit
  if (column.cardLimit !== null && column._count.cards >= column.cardLimit) {
    return Response.json(
      {
        error: 'Validation failed',
        fields: {
          columnId: `Column WIP limit of ${column.cardLimit} has been reached`,
        },
      },
      { status: 422 },
    )
  }

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

  if (typeof input.title !== 'string' || input.title.trim() === '') {
    fields.title = 'title must be a non-empty string'
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  try {
    // Determine next position: max existing position + 1
    const lastCard = await prisma.card.findFirst({
      where: { columnId, isArchived: false },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const position = lastCard ? Math.floor(lastCard.position) + 1 : 1

    const card = await prisma.card.create({
      data: {
        title: (input.title as string).trim(),
        columnId,
        boardId: column.board.id,
        position,
      },
    })

    return Response.json(card, { status: 201 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
