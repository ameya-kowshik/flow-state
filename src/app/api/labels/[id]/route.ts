import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// PUT /api/labels/[id] — rename and/or recolor a board label
// Optional body fields (at least one required):
//   name  — non-empty string
//   color — hex color string e.g. "#FF5733"
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify label exists and user owns the parent board
  const label = await prisma.label.findUnique({
    where: { id },
    include: { board: { select: { userId: true } } },
  })
  if (!label) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (label.board.userId !== session.user.id) {
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
  const data: { name?: string; color?: string } = {}

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

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  if (Object.keys(data).length === 0) {
    return Response.json(
      { error: 'Validation failed', fields: { _: 'At least one of name or color must be provided' } },
      { status: 422 },
    )
  }

  try {
    const updated = await prisma.label.update({ where: { id }, data })
    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/labels/[id] — hard delete; Prisma cascade removes CardLabel rows
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  const label = await prisma.label.findUnique({
    where: { id },
    include: { board: { select: { userId: true } } },
  })
  if (!label) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (label.board.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.label.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
