import { FastifyPluginAsync } from 'fastify';

/**
 * Small enough that it doesn't need the full routes/service/repository split
 * yet — a public, read-only reference list. Split it out the same way
 * `profiles` is structured if it ever grows write endpoints.
 */
const cuisinesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/cuisines', async () => {
    const { data, error } = await fastify.supabase
      .from('cuisines')
      .select('id, name, slug, region')
      .order('name');

    if (error) throw error;
    return { cuisines: data };
  });
};

export default cuisinesRoutes;
