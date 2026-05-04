import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// PUT /api/subtasks/[id] — toggle isCompleted and/or rename
// Optional body fields (at least one required):
//   title       — non-empty string
//   isCompleted — boolean
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify subtask exists and user owns the parent board
  const subtask = await prisma.subtask.findUnique({
    where: { id },
    include: {
      card: {
        include: { board: { select: { userId: true } } },
      },
    },
  })
  if (!subtask) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (subtask.card.board.userId !== session.user.id) {
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
  const data: { title?: string; isCompleted?: boolean } = {}

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim() === '') {
      fields.title = 'title must be a non-empty string'
    } else {
      data.title = input.title.trim()
    }
  }

  if (input.isCompleted !== undefined) {
    if (typeof input.isCompleted !== 'boolean') {
      fields.isCompleted = 'isCompleted must be a boolean'
    } else {
      data.isCompleted = input.isCompleted
    }
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  if (Object.keys(data).length === 0) {
    return Response.json(
      { error: 'Validation failed', fields: { _: 'At least one of title or isCompleted must be provided' } },
      { status: 422 },
    )
  }

  try {
    const updated = await prisma.subtask.update({ where: { id }, data })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/subtasks/[id] — hard delete
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  const subtask = await prisma.subtask.findUnique({
    where: { id },
    include: {
      card: {
        include: { board: { select: { userId: true } } },
      },
    },
  })
  if (!subtask) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (subtask.card.board.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.subtask.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
