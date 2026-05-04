import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// POST /api/boards/[id]/labels — create a board-scoped label with name + color
// Body: { name: string; color: string }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: boardId } = await ctx.params

  // Verify board exists and user owns it
  const board = await prisma.board.findUnique({ where: { id: boardId } })
  if (!board) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (board.userId !== session.user.id) {
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

  if (typeof input.name !== 'string' || input.name.trim() === '') {
    fields.name = 'name must be a non-empty string'
  }

  if (typeof input.color !== 'string') {
    fields.color = 'color must be a string'
  } else if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(input.color)) {
    fields.color = 'color must be a valid hex color (e.g. "#FF5733")'
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  try {
    const label = await prisma.label.create({
      data: {
        boardId,
        name: (input.name as string).trim(),
        color: input.color as string,
      },
    })

    return Response.json(label, { status: 201 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
