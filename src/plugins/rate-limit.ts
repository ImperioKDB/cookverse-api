import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Global default: 100 req/min per IP, backed by Redis so it holds up across
 * multiple API instances. Per 04-api-design.md, write-heavy/auth routes get
 * a tighter limit later via per-route config (`config: { rateLimit: {...} }`) —
 * not needed yet with only the profiles module live.
 */
const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 100),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? '1 minute',
    redis: fastify.redis,
    // Keyed by IP for now — per-user keying needs request.user, which isn't
    // populated yet at the point this global hook runs. Revisit once
    // per-route auth-aware limits are actually needed.
    keyGenerator: (request) => request.ip,
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit', dependencies: ['redis'] });
