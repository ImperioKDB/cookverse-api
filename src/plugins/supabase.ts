import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}

/**
 * Decorates the Fastify instance with a service-role Supabase client.
 * This key bypasses RLS — never expose it to the frontend, only use it here
 * on the backend, and never forward it in a response.
 */
const supabasePlugin: FastifyPluginAsync = async (fastify) => {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)');
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  fastify.decorate('supabase', supabase);
};

export default fp(supabasePlugin, { name: 'supabase' });


