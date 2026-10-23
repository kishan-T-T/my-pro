import dotenv from 'dotenv';

// Set the NODE_ENV to 'development' by default
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

dotenv.config();

export const config = {
  /**
   * Server port (defaults to 5000 if PORT is not set)
   */
  port: parseInt(process.env.PORT, 10) || 5000,

  /**
   * Supabase configuration
   */
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET,

  /**
   * API configs
   */
  api: {
    prefix: '/api/v1',
  },

  /**
   * Auth0 Credentials (optional if using Supabase Auth)
   */
  audience: process.env.AUTH0_AUDIENCE,
  domain: process.env.AUTH0_DOMAIN,
  clientOriginUrl: process.env.CLIENT_ORIGIN_URL,
};
