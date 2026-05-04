import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// GET /api/boards/[id] — single board with its columns and cards
// Columns ordered by position, cards ordered by position within each column.
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  ctx: RouteContext,
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              where: { isArchived: false },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    })

    if (!board) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    if (board.userId !== session.user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return Response.json(board)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PUT /api/boards/[id] — update board fields
// Optional body fields (at least one required):
//   name       — non-empty string
//   color      — hex color string e.g. "#FF5733"
//   isStarred  — boolean (toggle starred state)
//   isArchived — boolean (toggle archived state)
// ---------------------------------------------------------------------------
export async function PUT(
  req: NextRequest,
  ctx: RouteContext,
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify existence and ownership
  const existing = await prisma.board.findUnique({ where: { id } })
  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.userId !== session.user.id) {
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
  const data: {
    name?: string
    color?: string
    isStarred?: boolean
    isArchived?: boolean
  } = {}

  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim() === '') {
      fields.name = 'name must be a non-empty string'
    } else {
      data.name = input.name.trim()
    }
  }

  if (input.color !== undefined) {
    if (typeof input.color !== 'string') {
      fields.color = 'color must be a string'
    } else if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(input.color)) {
      fields.color = 'color must be a valid hex color (e.g. "#FF5733")'
    } else {
      data.color = input.color
    }
  }

  if (input.isStarred !== undefined) {
    if (typeof input.isStarred !== 'boolean') {
      fields.isStarred = 'isStarred must be a boolean'
    } else {
      data.isStarred = input.isStarred
    }
  }

  if (input.isArchived !== undefined) {
    if (typeof input.isArchived !== 'boolean') {
      fields.isArchived = 'isArchived must be a boolean'
    } else {
      data.isArchived = input.isArchived
    }
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  if (Object.keys(data).length === 0) {
    return Response.json(
      {
        error: 'Validation failed',
        fields: { _: 'At least one of name, color, isStarred, or isArchived must be provided' },
      },
      { status: 422 },
    )
  }

  try {
    const updated = await prisma.board.update({ where: { id }, data })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/boards/[id] — hard delete, owner-only
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext,
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify existence and ownership
  const existing = await prisma.board.findUnique({ where: { id } })
  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.board.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
