import { FastifyPluginAsync } from 'fastify';
import { GamificationRepository } from './gamification.repository';
import { GamificationService } from './gamification.service';

const gamificationRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new GamificationService(new GamificationRepository(fastify.supabase));

  fastify.get('/gamification/me', { preHandler: fastify.authenticate }, async (request) => {
    return service.getSummary(request.user!.id);
  });

  fastify.post('/gamification/checkin', { preHandler: fastify.authenticate }, async (request) => {
    return service.checkIn(request.user!.id);
  });
};

export default gamificationRoutes;
