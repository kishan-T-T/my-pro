import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

let supabaseInstance = null;

/**
 * Allows injecting a custom or mock Supabase client (e.g., for testing).
 */
export const setSupabaseClient = (client) => {
  supabaseInstance = client;
};

/**
 * Returns the active Supabase client instance, initializing it lazily if needed.
 */
export const getSupabase = () => {
  if (!supabaseInstance) {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in environment variables.'
      );
    }
    supabaseInstance = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseInstance;
};

export const connectDB = async () => {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_KEY) {
      console.warn(
        'Warning: SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to the publishable/anon key, ' +
          'which Row Level Security blocks from reading or writing data. ' +
          'Add your Secret key (Dashboard -> Project Settings -> API Keys) to .env.'
      );
    }

    const supabase = getSupabase();
    const { error } = await supabase.from('users').select('id').limit(1);

    if (error) {
      throw new Error(
        `Supabase schema check failed (${error.message}). Make sure the schema is applied (run "supabase db push", or paste supabase/schema.sql into the Supabase SQL Editor).`
      );
    }

    console.log(`Supabase Connected: ${config.supabaseUrl}`);
    return supabase;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};
