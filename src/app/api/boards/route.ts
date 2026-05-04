import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/boards — all active (non-archived) boards for the authenticated user
// Starred boards are returned first, then ordered by createdAt ascending.
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const boards = await prisma.board.findMany({
      where: {
        userId: session.user.id,
        isArchived: false,
      },
      orderBy: [
        { isStarred: 'desc' },
        { createdAt: 'asc' },
      ],
    })

    return Response.json(boards)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST /api/boards — create a board with name + color
// Required body fields:
//   name  — non-empty string
//   color — hex color string e.g. "#FF5733"
// Returns 201 on success.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
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

  // Validate name
  if (!input.name || typeof input.name !== 'string' || input.name.trim() === '') {
    fields.name = 'name is required and must be a non-empty string'
  }

  // Validate color — must be a valid hex color (#RGB or #RRGGBB)
  if (!input.color || typeof input.color !== 'string') {
    fields.color = 'color is required'
  } else if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(input.color)) {
    fields.color = 'color must be a valid hex color (e.g. "#FF5733")'
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  const name = (input.name as string).trim()
  const color = input.color as string

  try {
    const board = await prisma.board.create({
      data: {
        userId: session.user.id,
        name,
        color,
      },
    })
    return Response.json(board, { status: 201 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
