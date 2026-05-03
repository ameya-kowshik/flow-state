import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings
 * Returns the current user's timer and notification settings.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      focusDuration: true,
      shortBreakDuration: true,
      longBreakDuration: true,
      longBreakInterval: true,
      soundEnabled: true,
      notificationsEnabled: true,
    },
  })

  if (!user) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json(user)
}

/**
 * PUT /api/settings
 * Persists updated timer and notification settings for the current user.
 *
 * Body (all fields optional):
 *   focusDuration        — positive integer (minutes)
 *   shortBreakDuration   — positive integer (minutes)
 *   longBreakDuration    — positive integer (minutes)
 *   longBreakInterval    — positive integer (phases before long break)
 *   soundEnabled         — boolean
 *   notificationsEnabled — boolean
 */
export async function PUT(req: NextRequest) {
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

  // Validate duration fields — must be positive integers when present
  const durationFields = [
    'focusDuration',
    'shortBreakDuration',
    'longBreakDuration',
    'longBreakInterval',
  ] as const

  for (const field of durationFields) {
    if (field in input) {
      const val = input[field]
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 1) {
        fields[field] = `${field} must be a positive integer`
      }
    }
  }

  // Validate boolean fields when present
  const boolFields = ['soundEnabled', 'notificationsEnabled'] as const
  for (const field of boolFields) {
    if (field in input) {
      if (typeof input[field] !== 'boolean') {
        fields[field] = `${field} must be a boolean`
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  // Build the update payload from only the fields that were provided
  const data: Partial<{
    focusDuration: number
    shortBreakDuration: number
    longBreakDuration: number
    longBreakInterval: number
    soundEnabled: boolean
    notificationsEnabled: boolean
  }> = {}

  for (const field of durationFields) {
    if (field in input) data[field] = input[field] as number
  }
  for (const field of boolFields) {
    if (field in input) data[field] = input[field] as boolean
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      focusDuration: true,
      shortBreakDuration: true,
      longBreakDuration: true,
      longBreakInterval: true,
      soundEnabled: true,
      notificationsEnabled: true,
    },
  })

  return Response.json(updated)
}
