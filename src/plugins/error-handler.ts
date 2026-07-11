import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyError } from 'fastify';

/**
 * Every error response uses the envelope shape from 04-api-design.md:
 * { error: { code, message, request_id } }
 */
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Unhandled request error');
    } else {
      request.log.warn({ err: error }, 'Request error');
    }

    reply.code(statusCode).send({
      error: {
        code: statusCode >= 500 ? 'internal_error' : (error.code ?? 'bad_request'),
        message: statusCode >= 500 ? 'Something went wrong on our end' : error.message,
        request_id: request.id,
      },
    });
  });

  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: 'not_found',
        message: `Route ${request.method} ${request.url} not found`,
        request_id: request.id,
      },
    });
  });
};

export default fp(errorHandlerPlugin, { name: 'error-handler' });
