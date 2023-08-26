import { Injectable } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

@Injectable()
export class RedisHelperService {
  private client: Redis
  public constructor(
    private readonly redis: RedisService,
  ) {
    this.client = redis.getClient();
  }

  public async getHash(key: string) {
    return this.client.hgetall(key);
  }

  public async createHash(key: string, data: object) {
    return this.client.hset(key, data);
  }
}