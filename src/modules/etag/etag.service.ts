import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { Etag, EtagInterface } from './etag.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class EtagService implements EtagInterface {
  constructor(
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}

  async getEtag(cacheKey: string, ttl: number = 86400): Promise<Etag> {
    // check the etag from cache; if not exists, we'll create it
    let etag: string | undefined = await this.cacheService.get<string>(cacheKey);
    if (!etag) {
      // create current time's md5 as etag hash value
      etag = crypto.createHash('md5').update(new Date().toString()).digest('hex');
      // @ts-ignore
      await this.cacheService.set(cacheKey, etag, { ttl: ttl });
    }
    return { etag: etag };
  }
}
