import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../../config/env.js';
import { findOrCreateOAuthUser } from './auth.service.js';

export function setupPassport() {
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${env.API_URL}/api/v1/auth/google/callback`,
          scope: ['profile', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email found in Google profile'));
            }

            const result = await findOrCreateOAuthUser('google', {
              id: profile.id,
              email,
              displayName: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
            });

            done(null, result);
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }

  // Microsoft strategy follows the same pattern
  // Add when MICROSOFT_CLIENT_ID is configured
}
