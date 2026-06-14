// Adapter configuration
// Fill in your API keys and configuration

import { RedisAdapter } from '../adapters/caching/redis';
import { StripeAdapter } from '../adapters/payments/stripe';
import { BullmqAdapter } from '../adapters/queues/bullmq';

// caching
//   // Redis connection URL
// export const cachingAdapter = new RedisAdapter({
//   url: process.env.URL,
// });

// payments
//   // Stripe secret API key
  // Stripe webhook signing secret
// export const paymentsAdapter = new StripeAdapter({
//   api_key: process.env.API_KEY,
//   webhook_secret: process.env.WEBHOOK_SECRET,
// });

// queues
//   // Redis connection URL for BullMQ
// export const queuesAdapter = new BullmqAdapter({
//   redis_url: process.env.REDIS_URL,
// });
