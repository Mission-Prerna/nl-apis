import {
  CacheKeyMentorDailyMetrics,
  CacheKeyMentorMonthlyMetrics,
  CacheKeyMentorMonthlyVisitedSchools,
  CacheKeyMentorWeeklyMetrics,
} from './enums';
import { RedisHelperService } from './RedisHelper.service';

abstract class CacheManager {
  protected cacheKeyMetrics: string = '';

  protected constructor(
    protected readonly mentorId: bigint,
    protected readonly year: number,
    protected readonly month: number,
    protected readonly redisHelper: RedisHelperService
  ) {}

  public async update(data: object) {
    return this.redisHelper.createHash(this.cacheKeyMetrics, data);
  }

  public async incrementBy(field: string, by: number = 1) {
    return this.redisHelper.incrHash(this.cacheKeyMetrics, field, by);
  }
}

export class MonthlyCacheManager extends CacheManager {
  protected readonly cacheKeyVisitedSchools: string;
  constructor(
    protected readonly mentorId: bigint,
    protected readonly year: number,
    protected readonly month: number,
    protected readonly redisHelper: RedisHelperService
  ) {
    super(mentorId, year, month, redisHelper);
    this.cacheKeyMetrics = CacheKeyMentorMonthlyMetrics(mentorId, month, year);
    this.cacheKeyVisitedSchools = CacheKeyMentorMonthlyVisitedSchools(mentorId, month, year);
  }

  public async get() {
    return {
      visited_schools: await this.redisHelper.setMembers(this.cacheKeyVisitedSchools),
      metrics: await this.redisHelper.getHash(this.cacheKeyMetrics),
    };
  }

  public async getSchoolsCount() {
    return this.redisHelper.setCardinality(this.cacheKeyVisitedSchools);
  }

  public async updateSchools(schools: Array<string>) {
    if (schools.length === 0) {
      return 0;
    }
    return this.redisHelper.setAdd(this.cacheKeyVisitedSchools, schools);
  }
}

export class WeeklyCacheManager extends CacheManager {
  constructor(
    protected readonly mentorId: bigint,
    protected readonly year: number,
    protected readonly week: number,
    protected readonly redisHelper: RedisHelperService
  ) {
    super(mentorId, year, week, redisHelper);
    this.cacheKeyMetrics = CacheKeyMentorWeeklyMetrics(mentorId, week, year);
  }

  public async get() {
    return this.redisHelper.getHash(this.cacheKeyMetrics);
  }
}

export class DailyCacheManager extends CacheManager {
  constructor(
    protected readonly mentorId: bigint,
    protected readonly year: number,
    protected readonly month: number,
    protected readonly day: number,
    protected readonly redisHelper: RedisHelperService
  ) {
    super(mentorId, year, month, redisHelper);
    this.cacheKeyMetrics = CacheKeyMentorDailyMetrics(mentorId, month,day, year);
  }

  public async get() {
    return this.redisHelper.getHash(this.cacheKeyMetrics);
  }
}