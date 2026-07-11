import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { User } from '@supabase/supabase-js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: User;
  }
}

/**
 * Verifies the bearer token by asking Supabase Auth to validate it
 * (fastify.supabase.auth.getUser). This is the simplest correct approach —
 * one extra network round-trip per authenticated request, traded for zero
 * key-management complexity. Worth revisiting for local JWKS verification
 * only once traffic actually makes that round-trip a measured bottleneck
 * (see the Scaling Roadmap's "don't preemptively over-engineer" principle).
 */
const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({
        error: {
          code: 'unauthorized',
          message: 'Missing or malformed Authorization header',
          request_id: request.id,
        },
      });
    }

    const token = authHeader.slice('Bearer '.length);
    const { data, error } = await fastify.supabase.auth.getUser(token);

    if (error || !data.user) {
      return reply.code(401).send({
        error: {
          code: 'invalid_token',
          message: 'Session is invalid or expired',
          request_id: request.id,
        },
      });
    }

    request.user = data.user;
  });
};

export default fp(authPlugin, { name: 'auth', dependencies: ['supabase'] });
