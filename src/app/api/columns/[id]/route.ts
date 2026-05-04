import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// PUT /api/columns/[id] — rename, update cardLimit, or toggle isCollapsed
// Body (at least one required): { name?, cardLimit?, isCollapsed? }
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify column exists and user owns the parent board
  const column = await prisma.column.findUnique({
    where: { id },
    include: { board: { select: { userId: true } } },
  })
  if (!column) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (column.board.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
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
  const data: { name?: string; cardLimit?: number | null; isCollapsed?: boolean } = {}

  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim() === '') {
      fields.name = 'name must be a non-empty string'
    } else {
      data.name = input.name.trim()
    }
  }

  if (input.cardLimit !== undefined) {
    if (input.cardLimit === null) {
      // Allow explicitly clearing the limit
      data.cardLimit = null
    } else if (
      typeof input.cardLimit !== 'number' ||
      !Number.isInteger(input.cardLimit) ||
      input.cardLimit < 1
    ) {
      fields.cardLimit = 'cardLimit must be a positive integer or null'
    } else {
      data.cardLimit = input.cardLimit as number
    }
  }

  if (input.isCollapsed !== undefined) {
    if (typeof input.isCollapsed !== 'boolean') {
      fields.isCollapsed = 'isCollapsed must be a boolean'
    } else {
      data.isCollapsed = input.isCollapsed
    }
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  if (Object.keys(data).length === 0) {
    return Response.json(
      {
        error: 'Validation failed',
        fields: { _: 'At least one of name, cardLimit, or isCollapsed must be provided' },
      },
      { status: 422 },
    )
  }

  try {
    const updated = await prisma.column.update({ where: { id }, data })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/columns/[id] — delete column
// If the column has cards, body must include { destinationColumnId: string }
// to move cards before deletion. The destination column must be on the same board.
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify column exists and user owns the parent board
  const column = await prisma.column.findUnique({
    where: { id },
    include: {
      board: { select: { userId: true } },
      _count: { select: { cards: { where: { isArchived: false } } } },
    },
  })
  if (!column) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (column.board.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const activeCardCount = column._count.cards

  if (activeCardCount > 0) {
    // Cards exist — require destinationColumnId
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json(
        {
          error: 'Validation failed',
          fields: {
            destinationColumnId:
              'This column has cards. Provide destinationColumnId to move them before deleting.',
          },
        },
        { status: 422 },
      )
    }

    if (typeof body !== 'object' || body === null) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const input = body as Record<string, unknown>

    if (typeof input.destinationColumnId !== 'string' || input.destinationColumnId.trim() === '') {
      return Response.json(
        {
          error: 'Validation failed',
          fields: {
            destinationColumnId:
              'This column has cards. Provide destinationColumnId to move them before deleting.',
          },
        },
        { status: 422 },
      )
    }

    const destColumnId = input.destinationColumnId.trim()

    // Verify destination column exists and belongs to the same board
    const destColumn = await prisma.column.findUnique({
      where: { id: destColumnId },
      select: { boardId: true },
    })
    if (!destColumn) {
      return Response.json(
        { error: 'Validation failed', fields: { destinationColumnId: 'Destination column not found' } },
        { status: 422 },
      )
    }
    if (destColumn.boardId !== column.boardId) {
      return Response.json(
        {
          error: 'Validation failed',
          fields: { destinationColumnId: 'Destination column must be on the same board' },
        },
        { status: 422 },
      )
    }

    try {
      // Move cards then delete column in a transaction
      await prisma.$transaction(async (tx) => {
        // Find the max position in the destination column to append after
        const lastCard = await tx.card.findFirst({
          where: { columnId: destColumnId, isArchived: false },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
        const basePosition = lastCard ? Math.floor(lastCard.position) + 1 : 1

        // Fetch cards to move, ordered by position
        const cardsToMove = await tx.card.findMany({
          where: { columnId: id, isArchived: false },
          orderBy: { position: 'asc' },
          select: { id: true },
        })

        // Reassign each card to the destination column with new positions
        for (let i = 0; i < cardsToMove.length; i++) {
          await tx.card.update({
            where: { id: cardsToMove[i].id },
            data: { columnId: destColumnId, position: basePosition + i },
          })
        }

        await tx.column.delete({ where: { id } })
      })

      return new Response(null, { status: 204 })
    } catch {
      return Response.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  // No active cards — delete directly
  try {
    await prisma.column.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
