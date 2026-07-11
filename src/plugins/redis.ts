import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error('REDIS_URL must be set (see .env.example)');
  }

  const redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    connectTimeout: 5000,
    // Give up after a few quick attempts on the *initial* connect so a
    // misconfigured/unreachable Redis fails the boot loudly instead of
    // hanging forever — ioredis's default retryStrategy never gives up.
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
  });

  redis.on('error', (err) => {
    fastify.log.error({ err }, 'Redis connection error');
  });

  await redis.connect();

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin, { name: 'redis' });
