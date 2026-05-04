import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// POST /api/cards/[id]/labels — attach a label to a card
// Body: { labelId: string }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: cardId } = await ctx.params

  // Verify card exists and user owns the parent board
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { board: { select: { id: true, userId: true } } },
  })
  if (!card) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (card.board.userId !== session.user.id) {
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

  if (typeof input.labelId !== 'string' || input.labelId.trim() === '') {
    return Response.json(
      { error: 'Validation failed', fields: { labelId: 'labelId must be a non-empty string' } },
      { status: 422 },
    )
  }

  const labelId = input.labelId.trim()

  // Verify label belongs to the same board
  const label = await prisma.label.findUnique({ where: { id: labelId } })
  if (!label) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (label.boardId !== card.board.id) {
    return Response.json(
      { error: 'Validation failed', fields: { labelId: 'label does not belong to this board' } },
      { status: 422 },
    )
  }

  try {
    const cardLabel = await prisma.cardLabel.create({
      data: { cardId, labelId },
      include: { label: true },
    })

    return Response.json(cardLabel, { status: 201 })
  } catch (err: unknown) {
    // P2002 = unique constraint violation (label already attached)
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return Response.json(
        { error: 'Validation failed', fields: { labelId: 'label is already attached to this card' } },
        { status: 422 },
      )
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
