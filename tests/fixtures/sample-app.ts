export const sampleApp = `
import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

// [ANCHOR:ROUTES]

// [ANCHOR:MIDDLEWARE]

fastify.listen({ port: 3000 });
`;

export const paymentsModule = {
  name: "payments",
  route:
    "import { paymentsRouter } from './modules/payments.js';\nfastify.register(paymentsRouter, { prefix: '/api/payments' });",
  middleware:
    "import { validatePayment } from './modules/payments.js';\nfastify.addHook('preHandler', validatePayment);",
};
