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

  public async expireAt(key: string, at: number) {
    return this.client.expireat(key, at);
  }

  public async delKey(keys: Array<string>) {
    return this.client.del(keys);
  }

  public async getHash(key: string) {
    return this.client.hgetall(key);
  }

  public async createHash(key: string, data: object) {
    return this.client.hset(key, data);
  }

  public async incrHash(key: string, field: string, by: number = 1) {
    return this.client.hincrby(key, field, by);
  }

  public async setAdd(key: string, items: Array<string>) {
    return this.client.sadd(key, items);
  }

  public async setCardinality(key: string) {
    return this.client.scard(key);
  }

  public async setMembers(key: string) {
    return this.client.smembers(key);
  }
}