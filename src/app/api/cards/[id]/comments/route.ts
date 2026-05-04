import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// POST /api/cards/[id]/comments — create a comment with body
// Body: { body: string }
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
    include: { board: { select: { userId: true } } },
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

  if (typeof input.body !== 'string' || input.body.trim() === '') {
    return Response.json(
      { error: 'Validation failed', fields: { body: 'body must be a non-empty string' } },
      { status: 422 },
    )
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        cardId,
        userId: session.user.id,
        body: input.body.trim(),
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    })

    return Response.json(comment, { status: 201 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
