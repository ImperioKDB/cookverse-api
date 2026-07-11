import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import supabasePlugin from './plugins/supabase';
import redisPlugin from './plugins/redis';
import authPlugin from './plugins/auth';
import errorHandlerPlugin from './plugins/error-handler';
import rateLimitPlugin from './plugins/rate-limit';
import healthRoutes from './modules/health/health.routes';
import profilesRoutes from './modules/profiles/profiles.routes';
import cuisinesRoutes from './modules/cuisines/cuisines.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
    },
  });

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  });

  // Order matters: error handling first, then infra clients, then anything
  // that depends on them (rate-limit needs redis, auth needs supabase).
  await fastify.register(errorHandlerPlugin);
  await fastify.register(supabasePlugin);
  await fastify.register(redisPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(authPlugin);

  await fastify.register(healthRoutes);
  await fastify.register(profilesRoutes, { prefix: '/v1' });
  await fastify.register(cuisinesRoutes, { prefix: '/v1' });

  return fastify;
}
