import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// POST /api/cards/[id]/subtasks — create a subtask with title
// Body: { title: string }
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

  if (typeof input.title !== 'string' || input.title.trim() === '') {
    return Response.json(
      { error: 'Validation failed', fields: { title: 'title must be a non-empty string' } },
      { status: 422 },
    )
  }

  try {
    // Append at end: find max position among existing subtasks
    const last = await prisma.subtask.findFirst({
      where: { cardId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const position = (last?.position ?? 0) + 1

    const subtask = await prisma.subtask.create({
      data: {
        cardId,
        title: input.title.trim(),
        position,
      },
    })

    return Response.json(subtask, { status: 201 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
