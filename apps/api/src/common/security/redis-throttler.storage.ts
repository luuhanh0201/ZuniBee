import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import Redis from 'ioredis';

const INCREMENT_SCRIPT = `
local blockedTtl = redis.call('PTTL', KEYS[2])
if blockedTtl > 0 then
  return {tonumber(ARGV[2]) + 1, 0, 1, math.ceil(blockedTtl / 1000)}
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  local duration = tonumber(ARGV[3])
  if duration <= 0 then duration = tonumber(ARGV[1]) end
  redis.call('SET', KEYS[2], '1', 'PX', duration)
  redis.call('DEL', KEYS[1])
  return {hits, math.ceil(ttl / 1000), 1, math.ceil(duration / 1000)}
end
return {hits, math.ceil(ttl / 1000), 0, 0}
`;

type ThrottlerRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallback = new ThrottlerStorageService();
  private readonly redis?: Redis;
  private unavailableUntil = 0;

  constructor(config: ConfigService) {
    if (config.get<string>('NODE_ENV') === 'test') return;
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    this.redis.on('error', () => undefined);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerRecord> {
    if (!this.redis || Date.now() < this.unavailableUntil) {
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const redisKey = `zunibee:throttle:${key}`;
      const result = (await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        redisKey,
        `${redisKey}:blocked`,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];
      return {
        totalHits: Number(result[0]),
        timeToExpire: Math.max(0, Number(result[1])),
        isBlocked: Number(result[2]) === 1,
        timeToBlockExpire: Math.max(0, Number(result[3])),
      };
    } catch {
      this.unavailableUntil = Date.now() + 30_000;
      this.logger.warn(
        'Redis rate-limit unavailable; temporarily using in-memory storage',
      );
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.fallback.onApplicationShutdown();
    if (!this.redis) return;
    if (this.redis.status === 'ready') await this.redis.quit();
    else this.redis.disconnect();
  }
}
