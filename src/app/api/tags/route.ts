import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/tags — all tags for the authenticated user
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tags = await prisma.tag.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json(tags)
}

// ---------------------------------------------------------------------------
// POST /api/tags — create a tag with name + hex color
// Required body fields:
//   name  — non-empty string
//   color — hex color string e.g. "#FF5733"
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

  // Enforce unique name per user (Requirement 5.6)
  try {
    const tag = await prisma.tag.create({
      data: { userId: session.user.id, name, color },
    })
    return Response.json(tag, { status: 201 })
  } catch (err: unknown) {
    // Prisma unique constraint violation code
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return Response.json(
        { error: 'Validation failed', fields: { name: 'A tag with this name already exists' } },
        { status: 422 },
      )
    }
    throw err
  }
}
