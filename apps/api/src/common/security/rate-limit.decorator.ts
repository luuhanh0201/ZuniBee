import { Throttle } from '@nestjs/throttler';

type ThrottleRequest = {
  ip?: string;
  body?: { email?: unknown };
};

const authTracker = (request: Record<string, unknown>) => {
  const req = request as ThrottleRequest;
  const email =
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase().slice(0, 320)
      : 'none';
  return `${req.ip ?? 'unknown'}:${email}`;
};

export const LoginRateLimit = () =>
  Throttle({
    burst: {
      limit: 3,
      ttl: 10_000,
      blockDuration: 30_000,
      getTracker: authTracker,
    },
    default: {
      limit: 5,
      ttl: 60_000,
      blockDuration: 60_000,
      getTracker: authTracker,
    },
    sustained: {
      limit: 20,
      ttl: 3_600_000,
      blockDuration: 900_000,
      getTracker: authTracker,
    },
  });

export const PasswordRecoveryRateLimit = () =>
  Throttle({
    burst: {
      limit: 2,
      ttl: 60_000,
      blockDuration: 60_000,
      getTracker: authTracker,
    },
    default: {
      limit: 3,
      ttl: 900_000,
      blockDuration: 900_000,
      getTracker: authTracker,
    },
    sustained: {
      limit: 6,
      ttl: 3_600_000,
      blockDuration: 3_600_000,
      getTracker: authTracker,
    },
  });

export const ExpensiveOperationRateLimit = () =>
  Throttle({
    burst: { limit: 2, ttl: 10_000, blockDuration: 30_000 },
    default: { limit: 5, ttl: 60_000, blockDuration: 60_000 },
    sustained: { limit: 30, ttl: 3_600_000, blockDuration: 900_000 },
  });

export const GuestAttemptRateLimit = () =>
  Throttle({
    burst: { limit: 3, ttl: 10_000, blockDuration: 30_000 },
    default: { limit: 10, ttl: 60_000, blockDuration: 60_000 },
    sustained: { limit: 100, ttl: 3_600_000, blockDuration: 900_000 },
  });
