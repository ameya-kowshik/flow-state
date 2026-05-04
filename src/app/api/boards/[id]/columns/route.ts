import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// POST /api/boards/[id]/columns — create a new column at the end of the board
// Body: { name: string, cardLimit?: number }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: boardId } = await ctx.params

  // Verify board exists and belongs to user
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

  if (input.cardLimit !== undefined) {
    if (
      typeof input.cardLimit !== 'number' ||
      !Number.isInteger(input.cardLimit) ||
      input.cardLimit < 1
    ) {
      fields.cardLimit = 'cardLimit must be a positive integer'
    }
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  try {
    // Determine next position: max existing position + 1 (integer positions)
    const lastColumn = await prisma.column.findFirst({
      where: { boardId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const position = lastColumn ? Math.floor(lastColumn.position) + 1 : 1

    const column = await prisma.column.create({
      data: {
        boardId,
        name: (input.name as string).trim(),
        position,
        cardLimit: input.cardLimit !== undefined ? (input.cardLimit as number) : null,
      },
    })

    return Response.json(column, { status: 201 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
