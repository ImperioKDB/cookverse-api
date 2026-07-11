import { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  /**
   * Confirms both external dependencies are actually reachable, not just
   * that the process is running. Per the Phase 0 roadmap, this is the route
   * to check right after deploying, before wiring anything else up to it.
   */
  fastify.get('/health/deep', async (request, reply) => {
    const checks: Record<string, string> = {};

    try {
      const { error } = await fastify.supabase.from('profiles').select('id').limit(1);
      checks.supabase = error ? `error: ${error.message}` : 'ok';
    } catch (err) {
      checks.supabase = `error: ${(err as Error).message}`;
    }

    try {
      const pong = await fastify.redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : `unexpected response: ${pong}`;
    } catch (err) {
      checks.redis = `error: ${(err as Error).message}`;
    }

    const allOk = Object.values(checks).every((value) => value === 'ok');
    reply.code(allOk ? 200 : 503).send({ status: allOk ? 'ok' : 'degraded', checks });
  });
};

export default healthRoutes;
