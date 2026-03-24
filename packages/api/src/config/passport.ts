import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from '../db.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;

        if (!email) {
          return done(new Error('No email found in Google profile'));
        }

        // 1. Try to find user by googleId
        let user = await db.user.findUnique({
          where: { googleId: profile.id },
        });

        // 2. If not found, try to find by email (to link existing accounts)
        if (!user) {
          user = await db.user.findUnique({
            where: { email },
          });

          if (user) {
            // Update existing user with googleId and mark verified
            user = await db.user.update({
              where: { id: user.id },
              data: { googleId: profile.id, verified: true },
            });
          }
        }

        // 3. Create new user if still not found
        if (!user) {
          user = await db.user.create({
            data: {
              email,
              googleId: profile.id,
              firstName: profile.name?.givenName || 'Google',
              lastName: profile.name?.familyName || 'User',
              verified: true,
              // Password remains null for OAuth users
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

// Passport session setup (if using sessions, but we'll use JWT)
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await db.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
