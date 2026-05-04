import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// PUT /api/comments/[id] — edit comment body (author only)
// Body: { body: string }
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify comment exists and user is the author
  const comment = await prisma.comment.findUnique({ where: { id } })
  if (!comment) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (comment.userId !== session.user.id) {
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
    const updated = await prisma.comment.update({
      where: { id },
      data: { body: input.body.trim() },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/comments/[id] — hard delete (author only)
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  const comment = await prisma.comment.findUnique({ where: { id } })
  if (!comment) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (comment.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.comment.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
