import { handlers } from '@/lib/auth'

// Re-export the Auth.js GET and POST handlers for the catch-all route.
// Auth.js v5 handles all /api/auth/* paths (signin, signout, callback, session, etc.)
export const { GET, POST } = handlers
