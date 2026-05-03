import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
import type { NextAuthConfig } from 'next-auth'

// Extend the built-in session/JWT types to carry the internal Prisma User.id
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    /** Internal Prisma User.id (cuid) */
    userId?: string
  }
}

const config: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],

  session: {
    strategy: 'jwt',
  },

  callbacks: {
    /**
     * Called on every sign-in. Upserts the User row in Prisma, keyed on the
     * Google account ID (account.providerAccountId === Google's `sub`).
     * Always updates lastSeenAt so requirement 1.3 is satisfied.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== 'google' || !profile?.sub) {
        // Only allow Google sign-in
        return false
      }

      const googleId = profile.sub
      const email = profile.email as string
      const name = (profile.name as string | undefined) ?? null
      const image = (profile.picture as string | undefined) ?? null

      await prisma.user.upsert({
        where: { googleId },
        update: {
          lastSeenAt: new Date(),
          // Keep name/image/email in sync with Google profile
          name,
          image,
          email,
        },
        create: {
          googleId,
          email,
          name,
          image,
          lastSeenAt: new Date(),
        },
      })

      return true
    },

    /**
     * Embeds the internal Prisma User.id into the JWT on first sign-in so that
     * all subsequent auth() calls can return session.user.id without a DB lookup.
     */
    async jwt({ token, account, profile }) {
      if (account?.provider === 'google' && profile?.sub) {
        // First sign-in: look up the User row we just upserted
        const user = await prisma.user.findUnique({
          where: { googleId: profile.sub },
          select: { id: true },
        })
        if (user) {
          token.userId = user.id
        }
      }
      return token
    },

    /**
     * Exposes session.user.id (the internal Prisma cuid) to the client and to
     * server-side auth() calls. This is what all API route handlers use.
     */
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId
      }
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)
