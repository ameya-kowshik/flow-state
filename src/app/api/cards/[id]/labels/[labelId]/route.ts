import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string; labelId: string }> }

// ---------------------------------------------------------------------------
// DELETE /api/cards/[id]/labels/[labelId] — detach a label from a card
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: cardId, labelId } = await ctx.params

  // Verify card exists and user owns the parent board
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { board: { select: { userId: true } } },
  })
  if (!card) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (card.board.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the CardLabel join record exists
  const cardLabel = await prisma.cardLabel.findUnique({
    where: { cardId_labelId: { cardId, labelId } },
  })
  if (!cardLabel) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await prisma.cardLabel.delete({
      where: { cardId_labelId: { cardId, labelId } },
    })
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
