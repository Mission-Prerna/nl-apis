import {
  CacheKeyMentorDailyMetrics,
  CacheKeyMentorMonthlyMetrics,
  CacheKeyMentorMonthlyVisitedSchools,
  CacheKeyMentorWeeklyMetrics,
  MentorMonthlyMetrics,
} from './enums';
import { RedisHelperService } from './RedisHelper.service';
import { randomInt } from 'crypto';
const moment = require('moment');

abstract class CacheManager {
  protected cacheKeyMetrics: string = '';

  protected constructor(
    protected readonly mentorId: bigint,
    protected readonly year: number,
    protected readonly month: number,
    protected readonly redisHelper: RedisHelperService,
  ) {}

  public async update(data: object) {
    return this.redisHelper.createHash(this.cacheKeyMetrics, data);
  }

  public async incrementBy(field: string, by: number = 1) {
    return this.redisHelper.incrHash(this.cacheKeyMetrics, field, by);
  }

  public async invalidate(keys: Array<string>) {
    return this.redisHelper.delKey(keys);
  }

  public async expireAt(at: number) {
    return this.redisHelper.expireAt(this.cacheKeyMetrics, at);
  }
}

export class MonthlyCacheManager extends CacheManager {
  protected readonly cacheKeyVisitedSchools: string;
  constructor(
    protected readonly mentorId: bigint,
    protected readonly year: number,
    protected readonly month: number,
    protected readonly redisHelper: RedisHelperService,
  ) {
    super(mentorId, year, month, redisHelper);
    this.cacheKeyMetrics = CacheKeyMentorMonthlyMetrics(mentorId, month, year);
    this.cacheKeyVisitedSchools = CacheKeyMentorMonthlyVisitedSchools(
      mentorId,
      month,
      year,
    );
  }

  public async get() {
    return {
      visited_schools: await this.redisHelper.setMembers(
        this.cacheKeyVisitedSchools,
      ),
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

  public async create(
    visitedSchools: Array<string>,
    data: MentorMonthlyMetrics,
  ) {
    const date = new Date(),
      y = date.getFullYear(),
      m = date.getMonth();
    const firstDay = new Date(y, m, 1);
    let expireAt = moment(firstDay).add(1, 'month'); // we'll expire the key in next month
    expireAt = moment(expireAt).add(randomInt(1, 10), 'days'); // add random days to distribute load not exactly at month change

    return Promise.all([
      this.updateSchools(visitedSchools), // add udise to current month's set
      this.update({
        schools_visited: data.schools_visited,
        assessments_taken: data.assessments_taken,
        avg_time: data.avg_time,
        grade_1_assessments: data.grade_1_assessments,
        grade_2_assessments: data.grade_2_assessments,
        grade_3_assessments: data.grade_3_assessments,
      }), // create the hashmap in redis
      this.expireAt(expireAt.unix()), // make the key automatic expire next month
      this.redisHelper.expireAt(this.cacheKeyVisitedSchools, expireAt.unix()), // make the key automatic expire next month
    ]);
  }

  public async hydrate(
    udise: number,
    grade: number,
    totalTimeTaken: number,
    uniqueStudents: Record<string, number>,
  ) {
    const existingCache: MentorMonthlyMetrics | Record<string, any> =
      await this.get();
    if (Object.keys(existingCache.metrics).length) {
      // if there already is existing cache, then only we'll update the metric;
      // otherwise we'll wait for user to go on home screen, where all the
      // cache will be populated from the very beginning
      const assessmentsCount = Object.keys(uniqueStudents).length;
      await Promise.all([
        this.updateSchools([udise.toString()]), // set the current udise
        this.incrementBy('assessments_taken', assessmentsCount), // increment the total assessments count
        this.incrementBy(
          `grade_${grade.toString()}_assessments`,
          assessmentsCount,
        ), // increment this particular class's count
        this.update({
          schools_visited: await this.getSchoolsCount(),
          avg_time:
            (parseInt(existingCache.metrics.avg_time) *
              parseInt(existingCache.metrics.assessments_taken) +
              totalTimeTaken) /
            (parseInt(existingCache.metrics.assessments_taken) +
              assessmentsCount),
        }), // update the below counts
      ]);
      return true;
    }
    return false;
  }
}

export class WeeklyCacheManager extends CacheManager {
  constructor(
    protected readonly mentorId: bigint,
    protected readonly year: number,
    protected readonly week: number,
    protected readonly redisHelper: RedisHelperService,
  ) {
    super(mentorId, year, week, redisHelper);
    this.cacheKeyMetrics = CacheKeyMentorWeeklyMetrics(mentorId, week, year);
  }

  public async get() {
    return this.redisHelper.getHash(this.cacheKeyMetrics);
  }

  public async hydrate(assessmentsCount: number, nipunCount: number) {
    await Promise.all([
      this.incrementBy('assessments_taken', assessmentsCount),
      this.incrementBy('nipun_count', nipunCount),
    ]);
    return true;
  }

  public async create(data: object) {
    const expireAt = moment().add(1, 'week'); // we'll expire the key in next week
    return Promise.all([
      this.update(data),
      this.expireAt(expireAt.unix()), // make the key automatic expire after 1 week
    ]);
  }
}

export class DailyCacheManager extends CacheManager {
  constructor(
    protected readonly mentorId: bigint,
    protected readonly year: number,
    protected readonly month: number,
    protected readonly day: number,
    protected readonly redisHelper: RedisHelperService,
  ) {
    super(mentorId, year, month, redisHelper);
    this.cacheKeyMetrics = CacheKeyMentorDailyMetrics(
      mentorId,
      month,
      day,
      year,
    );
  }

  public async get() {
    return this.redisHelper.getHash(this.cacheKeyMetrics);
  }

  public async hydrate(assessmentsCount: number, nipunCount: number) {
    if (Object.keys(await this.get()).length) {
      // if there already is existing cache, then only we'll update the metric;
      // otherwise we'll wait for user to go on home screen, where all the
      // cache will be populated from the very beginning
      await Promise.all([
        this.incrementBy('assessments_taken', assessmentsCount),
        this.incrementBy('nipun_count', nipunCount),
      ]);
      return true;
    }
    return false;
  }

  public async create(data: object) {
    const expireAt = moment().add(1, 'day'); // we'll expire the key in next day
    return Promise.all([
      this.update(data),
      this.expireAt(expireAt.unix()), // make the key automatic expire after 1 week
    ]);
  }
}
