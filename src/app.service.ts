import {
  BadRequestException,
  CACHE_MANAGER,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger, UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateAssessmentVisitResult } from './dto/CreateAssessmentVisitResult.dto';
import { Prisma } from '@prisma/client';
import { CreateAssessmentSurveyResult } from './dto/CreateAssessmentSurveyResult.dto';
import {
  ActorEnum,
  AssessmentTypeEnum,
  AssessmentVisitResultsStudentModule,
  CacheConstants,
  CacheKeyMentorDetail,
  CacheKeyMentorSchoolList,
  CacheKeyMetadata,
  CacheKeyMentorMonthlyMetrics,
  Mentor,
  TypeTeacherHomeOverview,
  TypeAssessmentQuarterTables,
  CacheKeyMentorWeeklyMetrics,
  CacheKeyMentorDailyMetrics,
  MentorMonthlyMetrics,
  MentorWeeklyMetrics, MentorDailyMetrics, CacheKeySchoolStudents, Student, StudentMonthlyAssessmentStatus,
} from './enums';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import {
  getAssessmentVisitResultsQuery,
  getAssessmentVisitResultsStudentsQuery,
  getAssessmentVisitResultStudentOdkResultsQuery,
} from './queries.template';
import { DbTableNotFoundException } from './exceptions/db-table-not-found.exception';
import { CreateMentorDto } from './dto/CreateMentor.dto';
import { FusionauthService } from './fusionauth.service';
import { MentorCreationFailedException } from './exceptions/mentor-creation-failed.exception';
import { CreateMentorOldDto } from './dto/CreateMentorOld.dto';
import { SchoolGeofencingBlacklistDto } from './dto/SchoolGeofencingBlacklistDto';
import { GetAssessmentVisitResultsDto } from './dto/GetAssessmentVisitResults.dto';
import * as Sentry from '@sentry/minimal';
import { RedisHelperService } from './RedisHelper.service';
import { DailyCacheManager, MonthlyCacheManager, WeeklyCacheManager } from './cache.manager';
import { JwtService } from '@nestjs/jwt';
const moment = require('moment');

@Injectable()
export class AppService {
  protected readonly logger = new Logger(AppService.name);
  protected allTables: Record<string, any> = {};

  constructor(
    protected readonly prismaService: PrismaService,
    protected readonly configService: ConfigService,
    protected readonly faService: FusionauthService,
    protected readonly redisHelper: RedisHelperService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
    protected readonly jwtService: JwtService,
  ) {
    this.prismaService.$queryRawUnsafe(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema='public'
         AND table_type='BASE TABLE';    
    `).then((response) => {
      // @ts-ignore
      for (const table of response) {
        this.allTables[table.table_name] = true;  // push to object map
      }
      this.logger.log('Tables list loaded...');
    }).catch(error => this.logger.error('Unable to fetch tables list from DB!!!', error));
  }

  private monthQuarterMap = {
    '1': 'jan_mar',
    '2': 'jan_mar',
    '3': 'jan_mar',
    '4': 'apr_jun',
    '5': 'apr_jun',
    '6': 'apr_jun',
    '7': 'jul_sep',
    '8': 'jul_sep',
    '9': 'jul_sep',
    '10': 'oct_dec',
    '11': 'oct_dec',
    '12': 'oct_dec',
  };

  private getAssessmentVisitResultsTables(year: null | number = null, month: null | number = null): TypeAssessmentQuarterTables {
    if (year === null) {
      year = new Date().getFullYear();
    }
    if (month === null) {
      month = new Date().getMonth() + 1;  // since getMonth() gives index
    }

    // @ts-ignore
    const quarter: string = this.monthQuarterMap[month.toString()];
    const assessmentVisitResultsTable = `assessment_visit_results_v2_${year.toString()}_${quarter}`;
    const assessmentVisitResultsStudentsTable = `assessment_visit_results_students_${year.toString()}_${quarter}`;
    const assessmentVisitResultStudentOdkResultsTable = `assessment_visit_results_student_odk_results_${year.toString()}_${quarter}`;

    if (!this.allTables[assessmentVisitResultsTable]) {
      const error = `Missing quarter table ${assessmentVisitResultsTable}.`;
      const description = `To fix, execute the below query on DB console: \n${getAssessmentVisitResultsQuery(assessmentVisitResultsTable)}`;
      this.logger.error(error);
      this.logger.debug(description);
      throw new DbTableNotFoundException(error, description);
    } else if (!this.allTables[assessmentVisitResultsStudentsTable]) {
      const error = `Missing quarter table ${assessmentVisitResultsStudentsTable}.`;
      const description = `To fix, execute the below query on DB console: \n${getAssessmentVisitResultsStudentsQuery(assessmentVisitResultsStudentsTable, assessmentVisitResultsTable)}`;
      this.logger.error(error);
      this.logger.debug(description);
      throw new DbTableNotFoundException(error, description);
    } else if (!this.allTables[assessmentVisitResultStudentOdkResultsTable]) {
      const error = `Missing quarter table ${assessmentVisitResultStudentOdkResultsTable}.`;
      const description = `To fix, execute the below query on DB console: \n${getAssessmentVisitResultStudentOdkResultsQuery(assessmentVisitResultStudentOdkResultsTable, assessmentVisitResultsStudentsTable)}`;
      this.logger.error(error);
      this.logger.debug(description);
      throw new DbTableNotFoundException(error, description);
    }

    return {
      assessment_visit_results_v2: assessmentVisitResultsTable,
      assessment_visit_results_students: assessmentVisitResultsStudentsTable,
      assessment_visit_results_student_odk_results: assessmentVisitResultStudentOdkResultsTable,
    };
  }

  async createAssessmentVisitResult(
    createAssessmentVisitResultData: CreateAssessmentVisitResult,
  ) {
    let totalTimeTaken: number = 0;
    const submissionDate = new Date();  // we'll dump all records in the current quarter's table
    let uniqueStudents: Record<string, number> = {};
    const tables = this.getAssessmentVisitResultsTables(submissionDate.getFullYear(), submissionDate.getMonth() + 1); // since getMonth() gives month's index
    try {
      // Checking if Assessment visit result already exist; if not we'll create it
      // @ts-ignore
      let assessmentVisitResult = await this.prismaService[tables.assessment_visit_results_v2].findFirst({
        select: {
          id: true,
        },
        where: {
          submission_timestamp:
            createAssessmentVisitResultData.submission_timestamp,
          mentor_id: createAssessmentVisitResultData.mentor_id,
          grade: createAssessmentVisitResultData.grade,
          subject_id: createAssessmentVisitResultData.subject_id,
          udise: createAssessmentVisitResultData.udise,
        },
      });

      if (assessmentVisitResult) {
        // this is a duplicate submission; let's trigger Sentry event
        Sentry.captureMessage('Duplicate submission detected', {
          user: {
            id: createAssessmentVisitResultData.mentor_id + '',
          },
          extra: {
            submission_timestamp:
            createAssessmentVisitResultData.submission_timestamp,
            mentor_id: createAssessmentVisitResultData.mentor_id,
            grade: createAssessmentVisitResultData.grade,
            subject_id: createAssessmentVisitResultData.subject_id,
            udise: createAssessmentVisitResultData.udise,
          }
        });
        this.logger.log('Duplicate found. Ignoring..');
        return assessmentVisitResult; // we'll not process any further because it's a duplicate
      }

      // filtering student whose module is 'odk'
      const assessmentVisitResultStudents =
        createAssessmentVisitResultData.results.filter(
          (result) =>
            result.module === AssessmentVisitResultsStudentModule.ODK,
        );

      const response = await this.prismaService.$transaction(async (tx) => {
        // @ts-ignore
        assessmentVisitResult = await tx[tables.assessment_visit_results_v2].create({
          select: {
            id: true,
          },
          data: {
            submission_timestamp:
            createAssessmentVisitResultData.submission_timestamp,
            grade: createAssessmentVisitResultData.grade,
            subject_id: createAssessmentVisitResultData.subject_id,
            mentor_id: createAssessmentVisitResultData.mentor_id,
            actor_id: createAssessmentVisitResultData.actor_id,
            block_id: createAssessmentVisitResultData.block_id,
            assessment_type_id:
            createAssessmentVisitResultData.assessment_type_id,
            udise: createAssessmentVisitResultData.udise,
            no_of_student: createAssessmentVisitResultData.no_of_student,
            app_version_code:
            createAssessmentVisitResultData.app_version_code,
            module_result: {}, // populating it default
          },
        });

        const assessmentVisitResultId = assessmentVisitResult.id;

        for (const student of assessmentVisitResultStudents) {
          // Create student submission
          // @ts-ignore
          const assessmentVisitResultStudent = await tx[tables.assessment_visit_results_students].create({
            data: {
              student_name: student.student_name,
              competency_id: student.competency_id,
              module: student.module,
              end_time: student.end_time,
              is_passed: student.is_passed,
              start_time: student.start_time,
              statement: student.statement,
              achievement: student.achievement,
              total_questions: student.total_questions,
              success_criteria: student.success_criteria,
              session_completed: student.session_completed,
              is_network_active: student.is_network_active,
              workflow_ref_id: student.workflow_ref_id,
              total_time_taken: student.total_time_taken,
              student_session: student.student_session,
              assessment_visit_results_v2_id: assessmentVisitResult.id,
              submission_timestamp: createAssessmentVisitResultData.submission_timestamp,
              grade: createAssessmentVisitResultData.grade,
              mentor_id: createAssessmentVisitResultData.mentor_id,
              student_id: student.student_id ?? null,
            },
          });
          uniqueStudents[student.student_session] = student.is_passed ? 1 : 0;  // @TODO fix NIPUN logic
          if (!uniqueStudents.hasOwnProperty(student.student_session)) {
            // since the total time taken is same for a single student for all competencies, we'll consider one entry
            totalTimeTaken += student?.total_time_taken ?? 0;
          }

          const assessmentVisitResultStudentId = assessmentVisitResultStudent.id;

          // creating multiple Assessment visit results student odk results
          // noinspection TypeScriptValidateJSTypes
          // @ts-ignore
          await tx[tables.assessment_visit_results_student_odk_results].createMany({
            data: student.odk_results.map((odkResult) => {
              return {
                question: odkResult.question,
                answer: odkResult.answer,
                assessment_visit_results_students_id:
                  assessmentVisitResultStudentId,
              };
            }),
            skipDuplicates: true,
          });
        }

        // filtering student whose module is not 'odk'
        const nonOdkModuleStudents = createAssessmentVisitResultData.results
          .filter(
            (result) =>
              result.module !== AssessmentVisitResultsStudentModule.ODK,
          )
          .map((result) => {
            if (!uniqueStudents.hasOwnProperty(result.student_session)) {
              // since the total time taken is same for a single student for all competencies, we'll consider one entry
              totalTimeTaken += result?.total_time_taken ?? 0;
            }
            uniqueStudents[result.student_session] = result.is_passed ? 1 : 0;    // @TODO fix NIPUN logic
            return {
              student_name: result.student_name,
              competency_id: result.competency_id,
              module: result.module,
              end_time: result.end_time,
              is_passed: result.is_passed,
              start_time: result.start_time,
              statement: result.statement,
              achievement: result.achievement,
              total_questions: result.total_questions,
              success_criteria: result.success_criteria,
              session_completed: result.session_completed,
              is_network_active: result.is_network_active,
              workflow_ref_id: result.workflow_ref_id,
              total_time_taken: result.total_time_taken,
              student_session: result.student_session,
              assessment_visit_results_v2_id: assessmentVisitResultId,
              submission_timestamp: createAssessmentVisitResultData.submission_timestamp,
              grade: createAssessmentVisitResultData.grade,
              mentor_id: createAssessmentVisitResultData.mentor_id,
              student_id: result.student_id ?? null,
            };
          });

        if (nonOdkModuleStudents.length) {
          // @ts-ignore
          await tx[tables.assessment_visit_results_students].createMany({
            data: nonOdkModuleStudents,
            skipDuplicates: true,
          });
        }
        return assessmentVisitResult;
      }, {
        timeout: 15000,
      });

      // update metrics in cache
      const cacheHomeScreen = new MonthlyCacheManager(
        BigInt(createAssessmentVisitResultData.mentor_id),
        submissionDate.getFullYear(),
        submissionDate.getMonth() +1,
        this.redisHelper
      );

      const hydrated: boolean = await cacheHomeScreen.hydrate(createAssessmentVisitResultData.udise, createAssessmentVisitResultData.grade, totalTimeTaken, uniqueStudents)
      if (hydrated && createAssessmentVisitResultData.actor_id == ActorEnum.TEACHER && createAssessmentVisitResultData.assessment_type_id == AssessmentTypeEnum.NIPUN_ABHYAS) {
        // Let's now update teacher's metrics cache
        const assessmentsCount = Object.keys(uniqueStudents).length;
        const nipunCount = Object.values(uniqueStudents).reduce((partialSum, a) => partialSum + a, 0);
        const cacheDaily = new DailyCacheManager(BigInt(createAssessmentVisitResultData.mentor_id),
          submissionDate.getFullYear(), submissionDate.getMonth() + 1, submissionDate.getDate(), this.redisHelper);
        if (await cacheDaily.hydrate(assessmentsCount, nipunCount)) {
          // sync weekly metrics too because we synced daily as well
          const cacheWeekly = new WeeklyCacheManager(BigInt(createAssessmentVisitResultData.mentor_id),
            submissionDate.getFullYear(), moment().isoWeek(), this.redisHelper);
          await cacheWeekly.hydrate(assessmentsCount, nipunCount)
        }
      }
      return response;
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.handleRequestError(e);
    }
  }

  async getMentorSchoolListIfHeHasVisited(
    mentor: Mentor,
    month: number,
    year: number,
  ) {
    // We'll check if there is data in the cache
    const cachedData = await this.cacheService.get<any>(
      CacheKeyMentorSchoolList(mentor.phone_no, month, year),
    );
    if (cachedData) {
      return cachedData;
    }

    const tables = this.getAssessmentVisitResultsTables(year, month);
    const mentorId = Number(mentor.id);
    const firstDayTimestamp = Date.UTC(year, month - 1, 1, 0, 0, 0);  // first day of current month
    const lastDayTimestamp = Date.UTC(year, month, 1, 0, 0, 0); // first day of next month
    try {
      const response = await this.prismaService.$queryRawUnsafe(`SELECT 
        s.id as school_id,
        s."name" as school_name, 
        s.udise,
        s.district_id,
        d.name as district_name,
        s.block_id,
        b.name as block_name,
        s.nyay_panchayat_id,
        n.name as nyay_panchayat_name,
        (case when EXISTS(SELECT avr2.id from ${tables.assessment_visit_results_v2} as avr2 
            where avr2.udise = 	s.udise 
            and avr2.mentor_id = ${mentorId}
            and avr2.submission_timestamp > ${firstDayTimestamp} 
            and avr2.submission_timestamp < ${lastDayTimestamp})
          THEN true 
          ELSE false
        end) as is_visited,
        s.lat,
        s.long,
        s.geo_fence_enabled
      from school_list as s
      join districts d on d.id = s.district_id
      join blocks b on b.id = s.block_id
      left join nyay_panchayats n on n.id = s.nyay_panchayat_id
      where s.district_id = ${mentor.district_id}
      ${mentor.block_id ? `and s.block_id = ${mentor.block_id}` : ''}`);
      // @ts-ignore
      await this.cacheService.set(CacheKeyMentorSchoolList(mentor.phone_no, month, year), response, { ttl: CacheConstants.TTL_MENTOR_SCHOOL_LIST }); // Adding the data to cache
      return response;
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.handleRequestError(e);
    }
  }

  async createAssessmentSurveyResult(
    assessmentSurveyResult: CreateAssessmentSurveyResult,
  ) {
    try {
      // delete assessment survey if already created with this configuration (may throw an exception if record doesn't exists already)
      try {
        await this.prismaService.assessment_survey_result_v2.delete({
          where: {
            subject_id_submission_timestamp_mentor_id_grade_udise: {
              mentor_id: assessmentSurveyResult.mentor_id,
              subject_id: assessmentSurveyResult.subject_id ?? 0,
              grade: assessmentSurveyResult.grade,
              submission_timestamp: assessmentSurveyResult.submission_timestamp,
              udise: assessmentSurveyResult.udise,
            },
          },
        });
      } catch (e) {
        // pass
      }

      // create assessment survey
      return await this.prismaService.assessment_survey_result_v2.create({
        select: {
          id: true,
        },
        data: {
          submission_timestamp: assessmentSurveyResult.submission_timestamp,
          grade: assessmentSurveyResult.grade,
          actor_id: assessmentSurveyResult.actor_id,
          mentor_id: assessmentSurveyResult.mentor_id,
          subject_id: assessmentSurveyResult.subject_id || 0,
          udise: assessmentSurveyResult.udise,
          app_version_code: assessmentSurveyResult.app_version_code,
          assessment_survey_result_questions: {
            createMany: {
              data: assessmentSurveyResult.questions.map((x) => ({
                qid: x.question_id,
                value: x.value,
              })),
            },
          },
        },
      });
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.handleRequestError(e);
    }
  }

  /**
   * Transforms the cached redis hashmap response into the actual API response.
   * @param cachedData
   * @param mentor
   * @param month
   * @param year
   * @private
   */
  private async transformHomeScreenMetricCache(cachedData: MentorMonthlyMetrics | Record<string, any>, mentor: Mentor, month: number, year: number) {
    const response: Record<string, any> = {
      visited_schools: parseInt(cachedData.schools_visited),
      total_assessments: parseInt(cachedData.assessments_taken),
      average_assessment_time: parseInt(cachedData.avg_time),
      grades: [
        {
          grade: 1,
          total_assessments: parseInt(cachedData.grade_1_assessments)
        },
        {
          grade: 2,
          total_assessments: parseInt(cachedData.grade_2_assessments)
        },
        {
          grade: 3,
          total_assessments: parseInt(cachedData.grade_3_assessments)
        }
      ],
    };
    if (mentor.actor_id == ActorEnum.TEACHER) {
      const dailyData: MentorDailyMetrics | Record<string, any> = await this.redisHelper.getHash(CacheKeyMentorDailyMetrics(mentor.id, month, moment().date(), year));
      if (Object.keys(dailyData).length === 0) {
        response.teacher_overview = await this.getTeacherHomeScreenMetric(mentor);
      } else {
        const weeklyData: MentorWeeklyMetrics | Record<string, any> = await this.redisHelper.getHash(CacheKeyMentorWeeklyMetrics(mentor.id, moment().isoWeek(), year));
        response.teacher_overview = {
          assessments_total: parseInt(weeklyData.assessments_taken),
          nipun_total: parseInt(weeklyData.nipun_count),
          assessments_today: parseInt(dailyData.assessments_taken),
          nipun_today: parseInt(dailyData.nipun_count)
        }
      }
    }
    return response;
  }

  async getHomeScreenMetric(mentor: Mentor, month: number, year: number) {
    // We'll check if there is data in the cache
    const cachedData: MentorMonthlyMetrics | Record<string, any> = await this.redisHelper.getHash(CacheKeyMentorMonthlyMetrics(mentor.id, month, year));
    if (Object.keys(cachedData).length !== 0) {
      return this.transformHomeScreenMetricCache(cachedData, mentor, month, year);
    }

    const tables = this.getAssessmentVisitResultsTables(year, month);
    const firstDayTimestamp = Date.UTC(year, month - 1, 1, 0, 0, 0);  // first day of current month
    const lastDayTimestamp = Date.UTC(year, month, 1, 0, 0, 0); // 1st day of next month

    try {
      const query = `
          SELECT
              (select count(DISTINCT udise)
               from ${tables.assessment_visit_results_v2} as avr2
               where avr2.mentor_id = ${mentor.id}
                 and avr2.udise > 0
                 and avr2.submission_timestamp > ${firstDayTimestamp}
                 and avr2.submission_timestamp < ${lastDayTimestamp}) AS schools_visited,
              COALESCE(AVG(avrs.total_time_taken), 0) :: int8 AS avg_time ,
              COUNT(DISTINCT avrs.student_session) AS assessments_taken,
              COUNT(DISTINCT CASE WHEN avrs.grade = 1 THEN avrs.student_session END) AS grade_1_assessments,
              COUNT(DISTINCT CASE WHEN avrs.grade = 2 THEN avrs.student_session END) AS grade_2_assessments,
              COUNT(DISTINCT CASE WHEN avrs.grade = 3 THEN avrs.student_session END) AS grade_3_assessments
          FROM ${tables.assessment_visit_results_students} AS avrs
          WHERE avrs.mentor_id = ${mentor.id}
            AND avrs.submission_timestamp > ${firstDayTimestamp}
            AND avrs.submission_timestamp < ${lastDayTimestamp}`;

      const result: Record<string, any> = await this.prismaService.$queryRawUnsafe(query);

      const response: Record<string, any> = {
        visited_schools: result[0]['schools_visited'],
        total_assessments: result[0]['assessments_taken'],
        average_assessment_time: result[0]['avg_time'],
        grades: [
          {
            grade: 1,
            total_assessments: result[0]['grade_1_assessments'],
          },
          {
            grade: 2,
            total_assessments: result[0]['grade_2_assessments'],
          },
          {
            grade: 3,
            total_assessments: result[0]['grade_3_assessments'],
          },
        ],
      };

      // find list of visited schools
      const visitedSchoolsResult: Array<{udise: bigint}> = await this.prismaService.$queryRawUnsafe(`
        select
          DISTINCT udise as udise
        from
          ${tables.assessment_visit_results_v2} as avr2
        where
          avr2.mentor_id = ${mentor.id}
          and avr2.udise > 0
          and avr2.submission_timestamp > ${firstDayTimestamp} 
          and avr2.submission_timestamp < ${lastDayTimestamp}      
      `);

      const visitedSchools: Array<string> = visitedSchoolsResult.map((item) => {
        return item.udise.toString();
      });

      const cache = new MonthlyCacheManager(BigInt(mentor.id), year, month, this.redisHelper);
      await cache.create(visitedSchools, result[0]);  // create the hashmap in redis

      // creating DB table entry for the very first time
      await this.upsertCacheMentorMetrics(mentor, year, month, result[0]);

      if (mentor.actor_id == ActorEnum.TEACHER) {
        response.teacher_overview = await this.getTeacherHomeScreenMetric(mentor);
      }
      return response;
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.handleRequestError(e);
    }
  }

  async findMentorByPhoneNumber(phoneNumber: string): Promise<Mentor | null> {
    // We'll check if there is Mentor in the cache
    const cachedData = await this.cacheService.get<Mentor | null>(
      CacheKeyMentorDetail(phoneNumber),
    );
    if (cachedData) {
      return cachedData;
    }

    const mentor = await this.prismaService.mentor.findFirst({
      where: {
        phone_no: `${phoneNumber}`,
      },
      select: {
        id: true,
        designation_id: true,
        district_id: true,
        districts: true,
        block_id: true,
        blocks: true,
        officer_name: true,
        phone_no: true,
        actor_id: true,
        teacher_school_list_mapping: {
          select: {
            school_list: {
              select: {
                id: true,
                district_id: true,
                districts: true,
                block_id: true,
                blocks: true,
                nyay_panchayat_id: true,
                nyay_panchayats: true,
                name: true,
                udise: true,
                lat: true,
                long: true,
                geo_fence_enabled: true,
              },
            },
          },
        },
      },
    });

    let temp: any = mentor;
    if (mentor) {
      temp.district_name = mentor?.districts?.name ?? '';
      temp.block_town_name = mentor?.blocks?.name ?? '';

      const teacher_school_list_mapping: any = mentor?.teacher_school_list_mapping[0] ?? null;
      if (teacher_school_list_mapping) {
        teacher_school_list_mapping.school_list.school_id = teacher_school_list_mapping?.school_list?.id ?? '';
        teacher_school_list_mapping.school_list.school_name = teacher_school_list_mapping?.school_list?.name ?? '';
        teacher_school_list_mapping.school_list.district_name = teacher_school_list_mapping?.school_list?.districts?.name ?? '';
        teacher_school_list_mapping.school_list.block_name = teacher_school_list_mapping?.school_list?.blocks?.name ?? '';
        teacher_school_list_mapping.school_list.nyay_panchayat_name = teacher_school_list_mapping?.school_list?.nyay_panchayats?.name ?? '';

        delete teacher_school_list_mapping.school_list.districts;
        delete teacher_school_list_mapping.school_list.blocks;
        delete teacher_school_list_mapping.school_list.nyay_panchayats;
        delete teacher_school_list_mapping.school_list.id;
        delete teacher_school_list_mapping.school_list.name;
      }
      temp.teacher_school_list_mapping = teacher_school_list_mapping;
      delete temp.districts;
      delete temp.blocks;
    }
    // @ts-ignore
    await this.cacheService.set(CacheKeyMentorDetail(phoneNumber), temp, { ttl: CacheConstants.TTL_MENTOR_FROM_TOKEN }); // Adding the mentor to cache
    return temp;
  }

  async getMentorDetails(mentor: Mentor, month: null | number = null, year: null | number = null) {
    if (year === null) {
      year = new Date().getFullYear();
    }
    if (month === null) {
      month = new Date().getMonth() + 1;  // since getMonth() gives index
    }

    return {
      mentor: mentor,
      school_list: await this.getMentorSchoolListIfHeHasVisited(mentor, month, year),
      home_overview: await this.getHomeScreenMetric(mentor, month, year),
    };
  }

  async getMetadata() {
    const cacheData = await this.cacheService.get(CacheKeyMetadata());
    if (cacheData) return cacheData;

    const resp = {
      actors: await this.prismaService.actors.findMany(),
      designations: await this.prismaService.designations.findMany({
        select: {
          id: true,
          name: true,
        },
      }),
      subjects: await this.prismaService.subjects.findMany({
        select: {
          id: true,
          name: true,
        },
      }),
      assessment_types: await this.prismaService.assessment_types.findMany(),
      competency_mapping: await this.prismaService.competency_mapping.findMany({
        select: {
          grade: true,
          learning_outcome: true,
          competency_id: true,
          flow_state: true,
          subject_id: true,
        },
        orderBy: {
          learning_outcome: 'asc',
        },
      }),
      workflow_ref_ids: await this.prismaService.workflow_refids_mapping.findMany({
        select: {
          competency_id: true,
          grade: true,
          is_active: true,
          ref_ids: true,
          subject_id: true,
          type: true,
          assessment_type_id: true,
        },
        where: {
          is_active: true,
        },
      }),
    };
    // @ts-ignore
    await this.cacheService.set(CacheKeyMetadata(), resp, { ttl: CacheConstants.TTL_METADATA });
    return resp;
  }

  async updateMentorPin(mentor: Mentor, pin: number) {
    return await this.prismaService.mentor.update({
      where: {
        id: mentor.id,
      },
      data: {
        pin: pin.toString(),
      },
      select: {
        id: true,
      },
    });
  }

  async getActorHomeScreenRawQueryResult(
    tables: TypeAssessmentQuarterTables,
    mentor: Mentor,
    firstDayTimestamp: number,
    todayTimestamp: number,
    lastDayTimestamp: number): Promise<TypeTeacherHomeOverview | null> {
    try {
      const query = `
          select weekly.assessments_total, weekly.nipun_total, daily.assessments_today, daily.nipun_today
          from (
                   select count(distinct avrs.student_session)                                     as assessments_total,
                          count(distinct case when is_passed = true then avrs.student_session end) as nipun_total
                   from ${tables.assessment_visit_results_students} avrs
                            join ${tables.assessment_visit_results_v2} as avr2
                                 on (avr2.id = avrs.assessment_visit_results_v2_id and avr2.actor_id = ${ActorEnum.TEACHER} and
                                     avr2.assessment_type_id = ${AssessmentTypeEnum.NIPUN_ABHYAS})
                   where avrs.mentor_id = ${mentor.id}
                     and avrs.submission_timestamp > ${firstDayTimestamp}
                     and avrs.submission_timestamp < ${lastDayTimestamp}
               ) as weekly,
               (
                   select count(distinct avrs.student_session)                                     as assessments_today,
                          count(distinct case when is_passed = true then avrs.student_session end) as nipun_today
                   from ${tables.assessment_visit_results_students} avrs
                            join ${tables.assessment_visit_results_v2} as avr2
                                 on (avr2.id = avrs.assessment_visit_results_v2_id and avr2.actor_id = ${ActorEnum.TEACHER} and
                                     avr2.assessment_type_id =
                                     ${AssessmentTypeEnum.NIPUN_ABHYAS})
                   where avrs.mentor_id = ${mentor.id}
                     and avrs.submission_timestamp > ${todayTimestamp}
                     and avrs.submission_timestamp < ${lastDayTimestamp}
               ) as daily;
      `;
      const result: Array<TypeTeacherHomeOverview> = await this.prismaService.$queryRawUnsafe(query);

      return {
        assessments_total: result[0].assessments_total,
        nipun_total: result[0].nipun_total,
        assessments_today: result[0].assessments_today,
        nipun_today: result[0].nipun_today,
      };
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.handleRequestError(e);
    }
    return null;
  }

  async getTeacherHomeScreenMetric(mentor: Mentor) {
    const lastDate = new Date();  // it's now() basically
    const temp = new Date();
    const day = lastDate.getDay(), diff = lastDate.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    const firstDate = new Date(temp.setDate(diff));

    const tablesForFirstDate = this.getAssessmentVisitResultsTables(firstDate.getFullYear(), firstDate.getMonth() + 1);
    const tablesForLastDate = this.getAssessmentVisitResultsTables(lastDate.getFullYear(), lastDate.getMonth() + 1);

    let responseFirstTable: TypeTeacherHomeOverview | null;
    let responseSecondTable = null;
    if (tablesForFirstDate.assessment_visit_results_v2 === tablesForLastDate.assessment_visit_results_v2) {
      // both tables are same
      const firstDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0);
      const todayTimestamp = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate(), 0, 0, 0);
      const lastDayTimestamp = lastDate.getTime();

      responseFirstTable = await this.getActorHomeScreenRawQueryResult(
        tablesForFirstDate,
        mentor,
        firstDayTimestamp,
        todayTimestamp,
        lastDayTimestamp
      );
    } else {
      // if the data needs to queried from two tables, we'll query for both separately
      let firstDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0);
      const todayTimestamp = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate(), 0, 0, 0);
      let lastDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth() + 1, 1, 0, 0, 0); // next month's first date
      responseFirstTable = await this.getActorHomeScreenRawQueryResult(
        tablesForFirstDate,
        mentor,
        firstDayTimestamp,
        todayTimestamp,
        lastDayTimestamp
      );

      firstDayTimestamp = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), 1, 0, 0, 0);  // first day of current month
      lastDayTimestamp = lastDate.getTime();

      responseSecondTable = await this.getActorHomeScreenRawQueryResult(
        tablesForLastDate,
        mentor,
        firstDayTimestamp,
        todayTimestamp,
        lastDayTimestamp
      );
    }
    let response = responseFirstTable;
    if (responseSecondTable) {
      // we need to merge both table's response
      response = {
        assessments_total: (responseFirstTable?.assessments_total || 0) + (responseSecondTable?.assessments_total || 0),
        nipun_total: (responseFirstTable?.nipun_total || 0) + (responseSecondTable?.nipun_total || 0),
        assessments_today: (responseFirstTable?.assessments_today || 0) + (responseSecondTable?.assessments_today || 0),
        nipun_today: (responseFirstTable?.nipun_today || 0) + (responseSecondTable?.nipun_today || 0)
      }
    }

    const cacheWeekly = new WeeklyCacheManager(mentor.id, lastDate.getFullYear(), moment().isoWeek(), this.redisHelper);
    const cacheDaily = new DailyCacheManager(mentor.id, lastDate.getFullYear(), lastDate.getMonth() + 1,
      lastDate.getDate(), this.redisHelper);
    await Promise.all([
      cacheWeekly.create({
        'assessments_taken': response?.assessments_total ?? 0,
        'nipun_count': response?.nipun_total ?? 0,
      }),   // set weekly stats in redis
      cacheDaily.create({
        'assessments_taken': response?.assessments_today ?? 0,
        'nipun_count': response?.nipun_today ?? 0,
      }),   // set daily stats in redis
    ])
    return response;
  }

  async createMentorOld(data: CreateMentorOldDto) {
    let blockId = null;
    if (!['examiner', 'SRG'].includes(data.designation) && !data.block_town_name) {
      throw new BadRequestException(['block_town_name is required when designation is not in [examiner, SRG]']);
    } else {
      if (data.block_town_name) {
        blockId = (await this.prismaService.blocks.findFirstOrThrow({ where: { name: data.block_town_name } })).id;
      }
    }
    let actorId = ActorEnum.MENTOR;
    const designationId = (await this.prismaService.designations.findFirstOrThrow({ where: { name: data.designation } })).id;
    switch (data.designation) {
      case 'teacher':
        actorId = ActorEnum.TEACHER;
        break;
      case 'examiner':
        actorId = ActorEnum.EXAMINER;
        break;
      case 'Diet Mentor':
        actorId = ActorEnum.DIET_MENTOR;
        break;
    }
    const newDto: CreateMentorDto = {
      phone_no: data.phone_no,
      officer_name: data.officer_name,
      district_id: (await this.prismaService.districts.findFirstOrThrow({ where: { name: data.district_name } })).id,
      block_id: blockId,
      designation_id: designationId,
      actor_id: actorId,
      area_type: data.area_type,
      subject_of_matter: data.subject_of_matter,
      udise: data.udise,
    }
    return this.createMentor(newDto);
  }

  async createMentor(data: CreateMentorDto) {
    if (data.actor_id == ActorEnum.TEACHER && !data.udise) {
      throw new BadRequestException(['udise is needed when actor is "Teacher".']);
    }
    /*
      It's a 2-step process:
      1. Create a user on Fusion auth if not already exists.
      2. Create mentor at backend.
     */
    const applicationId = this.configService.getOrThrow<string>('FA_APPLICATION_ID');
    const response = await this.faService.createAndRegisterUser({
      user: {
        username: data.phone_no,
        mobilePhone: data.phone_no,
        password: this.configService.getOrThrow<string>('FA_DEFAULT_PASSWORD'),
        fullName: data.officer_name ?? '',
      },
      registration: {
        applicationId: applicationId,
        username: data.phone_no,
        roles: [],
      },
    });
    if (
      (
        // @ts-ignore
        response.statusCode == 400 && response.exception['fieldErrors']['user.username'][0]['code'] == '[duplicate]user.username'
      ) || response.statusCode == 200
    ) {
      // if success or duplicate username error, we consider it as success
      const mentor = await this.prismaService.mentor.upsert({
        where: {
          phone_no: data.phone_no
        },
        create: {
          phone_no: data.phone_no,
          area_type: data.area_type ?? null,
          officer_name: data.officer_name ?? null,
          subject_of_matter: data.subject_of_matter ?? null,
          district_id: data.district_id,
          block_id: data.block_id,
          designation_id: data.designation_id,
          actor_id: data.actor_id,
        },
        update: {
          area_type: data.area_type ?? null,
          officer_name: data.officer_name ?? null,
          subject_of_matter: data.subject_of_matter ?? null,
          district_id: data.district_id,
          block_id: data.block_id,
          designation_id: data.designation_id,
          actor_id: data.actor_id,
        }
      });

      if (data.actor_id == ActorEnum.TEACHER && data.udise) {
        const school = await this.prismaService.school_list.findFirstOrThrow({
          where: {
            udise: data.udise
          }
        });

        // delete all previous entries for mentor
        await this.prismaService.teacher_school_list_mapping.deleteMany({
          where: {
            mentor_id: mentor.id
          }
        });

        // create new teacher school mapping
        await this.prismaService.teacher_school_list_mapping.create({
          data: {
            mentor_id: mentor.id,
            school_list_id: school.id
          }
        })
      }

      return mentor;
    }
    let description = '';
    if (Number(this.configService.get('DEBUG', 1)) === 1) {
      description = JSON.stringify(response);
    }
    throw new MentorCreationFailedException('Mentor creation failed!!', description);
  }

  async schoolGeofencingBlacklist(data: SchoolGeofencingBlacklistDto) {
    // disable the geo-fencing if the udise list is not empty
    if (data.blacklist.length) {
      await this.prismaService.school_list.updateMany({
        where: {
          udise: {
            in: data.blacklist
          }
        },
        data: {
          geo_fence_enabled: false
        }
      });
    }
    if (data.whitelist.length) {
      await this.prismaService.school_list.updateMany({
        where: {
          udise: {
            in: data.whitelist
          }
        },
        data: {
          geo_fence_enabled: true
        }
      });
    }
    return 'ok';
  }

  /**
   *
   * @param params
   * @param baseId = 2023040000 (default) // base identifier starting from Apr 2023, the time quarter tables came into effect
   */
  async getAssessmentVisitResults(params: GetAssessmentVisitResultsDto, baseId = 2023040000): Promise<any> {
    if (params.id < baseId) {
      params.id = baseId;
    }
    const yearMonthIdentifier = (params.id + '').substring(0, 6);
    let yearIdentifier = yearMonthIdentifier.substring(0, 4);
    let year = parseInt(yearIdentifier);
    let monthIdentifier = yearMonthIdentifier.substring(4, 6);
    let month = parseInt(monthIdentifier);
    const rawId = parseInt((params.id + '').substring(6));
    const tables = this.getAssessmentVisitResultsTables(year, month);

    try {
      const relations: Record<string, any> = {
        school_list: {
          include: {
            districts: true,
            blocks: true,
            nyay_panchayats: true
          }
        },
        subjects: true,
        actors: true,
        blocks: true,
      }
      const studentRelation: Record<string, boolean> = {}
      studentRelation[tables.assessment_visit_results_student_odk_results] = true;
      relations[tables.assessment_visit_results_students] = {
        include: studentRelation
      };
      // @ts-ignore
      let assessmentVisitResults = await this.prismaService[tables.assessment_visit_results_v2].findMany({
        where: {
          id: {
            gt: rawId
          }
        },
        orderBy: {
          id: 'asc'
        },
        take: params.limit,
        include: relations
      });

      const results: Array<object> = [];
      for (const assessmentVisitResult of assessmentVisitResults) {
        let currentCount = 0;
        let studentResults: Array<object> = [];
        assessmentVisitResult[tables.assessment_visit_results_students].forEach((studentResult: Record<string, any>) => {
          currentCount++;
          studentResults.push({
            studentResults: {
              // competency: '',
              competencyId: studentResult.competency_id,
              currentStudentCount: currentCount,
              grade: assessmentVisitResult.grade,
              student_session: studentResult.student_session,
              moduleResult: {
                achievement: studentResult.achievement,
                appVersionCode: assessmentVisitResult.app_version_code ?? 0,
                endTime: studentResult.end_time,
                isPassed: studentResult.is_passed,
                module: studentResult.module,
                sessionCompleted: studentResult.session_completed,
                startTime: studentResult.start_time,
                statement: studentResult.statement,
                successCriteria: studentResult.success_criteria,
                totalQuestions: studentResult.total_questions
              },
              odkResultsData: {
                results: studentResult[tables.assessment_visit_results_student_odk_results].map((item: Record<string, any>) => {
                  return {
                    question: item.question,
                    answer: item.answer
                  }
                }),
                totalMarks: studentResult.achievement,
                totalQuestions: studentResult.total_questions
              },
              schoolsData: {
                address: "Address",
                block: assessmentVisitResult.school_list.blocks.name,
                district: assessmentVisitResult.school_list.districts.name,
                nyayPanchayat: assessmentVisitResult.school_list.nyay_panchayats.name,
                schoolName: assessmentVisitResult.school_list.name,
                schoolType: assessmentVisitResult.school_list.type,
                udise: assessmentVisitResult.school_list.udise,
                visitStatus: true
              },
              studentName: studentResult.student_name,
              subject: assessmentVisitResult.subjects.name
            },
            viewType: studentResult.module
          });
        });

        let idIdentifier;
        if (assessmentVisitResult.id < 10000) {
          idIdentifier = BigInt(parseInt(`${yearIdentifier}${monthIdentifier}`) * 10000) + BigInt(assessmentVisitResult.id);
        } else {
          idIdentifier = parseInt(`${yearIdentifier}${monthIdentifier}${assessmentVisitResult.id}`)
        }
        results.push({
          id: idIdentifier,
          grade: assessmentVisitResult.grade,
          is_visited: true,
          mentor_id: assessmentVisitResult.mentor_id,
          module_result: JSON.stringify(studentResults),
          no_of_student: assessmentVisitResult.no_of_student,
          // student_session: studentResult.student_session,
          subject: assessmentVisitResult.subjects.name,
          // total_time_taken: new Date(studentResult.total_time_taken * 1000).toISOString().substring(11, 19),
          udise_code: assessmentVisitResult.udise ? (assessmentVisitResult.udise + '') : '',
          actor: assessmentVisitResult?.actors?.name ?? '',
          block: assessmentVisitResult.block_id ? assessmentVisitResult.blocks.name : null,
          created_at: assessmentVisitResult.created_at
        })
      }
      if (results.length == 0) {
        const today = new Date();
        let newIdentifier = parseInt(`${yearIdentifier}${monthIdentifier}`);
        if (today.getFullYear() == year && (month < today.getMonth() + 1)) {
          // we'll call the same function recursively with next quarter's month identifier
          month = month + 3;  // as we want to go to next quarter's table
          monthIdentifier = (month < 10) ? `0${month}` : `${month}`;
          newIdentifier = parseInt(`${yearIdentifier}${monthIdentifier}0000`);

          // we must automatically send the results for the next quarter table
          params.id = 0;
          return await this.getAssessmentVisitResults(params, newIdentifier);
        } else if (year < today.getFullYear()) {
          // we'll call the same function recursively with next year's first month
          year++;
          yearIdentifier = year + '';
          newIdentifier = parseInt(`${yearIdentifier}010000`);

          // we must automatically send the results for the next quarter table
          params.id = 0;
          return await this.getAssessmentVisitResults(params, newIdentifier);
        }
      }
      return { assessment_visit_results: results };
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.handleRequestError(e);
    }
  }

  handleRequestError(e: any) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError ||
      e instanceof Prisma.PrismaClientUnknownRequestError ||
      e instanceof Prisma.PrismaClientValidationError
    ) {
      if (Number(this.configService.get('DEBUG', 1)) === 1) {
        throw new BadRequestException(e);
      }
      throw new BadRequestException();
    }

    if (Number(this.configService.get('DEBUG', 1)) === 1) {
      throw new InternalServerErrorException(e);
    }
    throw new InternalServerErrorException();
  }

  async upsertMentorToken(mentor: Mentor, token: string) {
    return await this.prismaService.mentor_tokens.upsert({
      where: {
        mentor_id: mentor.id,
      },
      update: {
        token: token,
      },
      create: {
        mentor_id: mentor.id,
        token: token
      },
    });
  }

  private async upsertCacheMentorMetrics(mentor: Mentor, year: number, month: number, result: MentorMonthlyMetrics) {
    // creating DB table entry
    const monthIdentifier = parseInt(year.toString() + (month < 10 ? `0${month.toString()}` : `${month.toString()}`));
    return this.prismaService.cache_mentor_metrics_monthly.upsert({
      where: {
        mentor_id_month: {
          mentor_id: mentor.id,
          month: monthIdentifier
        }
      },
      create: {
        mentor_id: mentor.id,
        month: monthIdentifier,
        schools_visited: parseInt(result.schools_visited.toString()),
        assessments_taken: parseInt(result.assessments_taken.toString()),
        avg_time: parseInt(result.avg_time.toString()),
        grade_1_assessments: parseInt(result.grade_2_assessments.toString()),
        grade_2_assessments: parseInt(result.grade_2_assessments.toString()),
        grade_3_assessments: parseInt(result.grade_3_assessments.toString()),
      },
      update: {
        schools_visited: parseInt(result.schools_visited.toString()),
        assessments_taken: parseInt(result.assessments_taken.toString()),
        avg_time: parseInt(result.avg_time.toString()),
        grade_1_assessments: parseInt(result.grade_2_assessments.toString()),
        grade_2_assessments: parseInt(result.grade_2_assessments.toString()),
        grade_3_assessments: parseInt(result.grade_3_assessments.toString()),
      }
    });
  }

  async setMentorBotTelemetry(mentorId: bigint, botId: string, action: number) {
    return this.prismaService.mentor_bot_telemetry.create({
      data: {
        "mentor_id": mentorId,
        "bot_id": botId,
        "action": action
      }
    });
  }

  async getMentorBotsWithAction(mentorId: bigint, action: number) {
    return this.prismaService.mentor_bot_telemetry.findMany({
      select: {
        bot_id: true,
      },
      where: {
        mentor_id: mentorId,
        action: action
      },
    });
  }

  async getSchoolStudents(udise: number): Promise<Array<Student>> {
    // We'll check if there is data in the cache
    const cachedData: Array<Student> | undefined = await this.cacheService.get<Array<Student>>(
      CacheKeySchoolStudents(udise),
    );
    if (cachedData) {
      return cachedData;
    }
    const response = await this.prismaService.students.findMany({
      where: {
        udise: BigInt(parseInt(udise.toString())),
        grade: {
          in: [1, 2, 3]
        }
      },
      select: {
        unique_id: true,
        name: true,
        grade: true,
      }
    });
    const students = response.map((item) => {
      return {
        id: item.unique_id,
        name: item.name,
        grade: item.grade
      }
    });
    if (students.length) {
      // cache results
      // @ts-ignore
      await this.cacheService.set(CacheKeySchoolStudents(udise), students, { ttl: CacheConstants.TTL_SCHOOL_STUDENTS })
    }
    return students;
  }

  public async getLoggedInMentor(
    authorizationHeader: string,
  ): Promise<Mentor> {
    const decodedAuthTokenData = this.checkTokenIfInvalid(authorizationHeader, false);

    // We'll check if the token is from the very same application as needed in the app
    if (decodedAuthTokenData && decodedAuthTokenData?.applicationId !== this.configService.get<string>('FA_APPLICATION_ID')) {
      throw new BadRequestException('Token is invalid!');
    }

    const mentor = await this.findMentorByPhoneNumber(
      decodedAuthTokenData?.['https://hasura.io/jwt/claims']?.[
        'X-Hasura-User-Id'
        ],
    );

    if (!mentor) {
      throw new BadRequestException('User is invalid!');
    }

    return mentor;
  }

  public checkTokenIfInvalid(authToken: string, admin: boolean = false): any {
    const decodedAuthTokenData = <Record<string, any>>(
      this.jwtService.decode(authToken.split(' ')[1])
    );

    // We'll check if the token is from the very same application as needed in the app
    const applicationId = admin ? this.configService.get<string>('FA_ADMIN_APPLICATION_ID') : this.configService.get<string>('FA_APPLICATION_ID');
    if (decodedAuthTokenData && decodedAuthTokenData?.applicationId !== applicationId) {
      throw new UnauthorizedException('Token is invalid!');
    }

    return decodedAuthTokenData;
  }

  async getSchoolStudentsResults(mentor: Mentor, udise: number, grades: Array<Number>, year: number, month: number) {
    const tables = this.getAssessmentVisitResultsTables(year, month);
    const firstDayTimestamp = Date.UTC(year, month - 1, 1, 0, 0, 0);  // first day of current month
    const lastDayTimestamp = Date.UTC(year, month, 1, 0, 0, 0); // 1st day of next month

    const query = `
      select distinct on (student_id) student_id as id,
                                           submission_timestamp last_assessment_date,
                                           is_passed
      from ${tables.assessment_visit_results_students}
      where mentor_id = ${mentor.id}
        and student_id is not null
        and submission_timestamp > ${firstDayTimestamp}
        and submission_timestamp < ${lastDayTimestamp}
      order by student_id, submission_timestamp DESC
    `;
    const studentWiseResults: Record<string, Student> = {};
    const result: Array<Student> = await this.prismaService.$queryRawUnsafe(query);
    result.forEach((res) => {
      // iterate and create a map student id wise for later faster fetching
      studentWiseResults[res.id.toString()] = res;
    });

    // Grade summary
    const gradeStudents: Record<string, {students: Array<Student>, nipun: number, not_nipun: number}> = {};
    (await this.getSchoolStudents(udise)).forEach(({ grade, id }: Student) => {
      grade = grade ?? 0; // just a ts check
      const assessedStudent = studentWiseResults[id.toString()] ?? null;
      if (!gradeStudents.hasOwnProperty(grade)) {
        gradeStudents[grade] = {
          students: [],
          nipun: 0,
          not_nipun: 0,
        }
      }
      if (assessedStudent) {
        assessedStudent.is_passed ? gradeStudents[grade].nipun++ : gradeStudents[grade].not_nipun++;
        gradeStudents[grade].students.push({
          id: id,
          status: assessedStudent.is_passed ? StudentMonthlyAssessmentStatus.PASS : StudentMonthlyAssessmentStatus.FAIL,
          last_assessment_date: assessedStudent.last_assessment_date,
        });
      } else {
        gradeStudents[grade].students.push({
          id: id,
          status: StudentMonthlyAssessmentStatus.PENDING,
          last_assessment_date: null,
        });
      }
    });
    let response: Array<Record<string, any>> = [];
    for (const grade of grades) {
      response.push({
        grade: grade,
        period: moment(month, 'M').format('MMMM') + ' माह',
        summary: [
          {
            label: 'Total',
            colour: '#FF0000',
            count: gradeStudents[grade.toString()].students.length
          },
          {
            label: 'Nipun',
            colour: '#FFFFFF',
            count: gradeStudents[grade.toString()].nipun
          },
          {
            label: 'Not Nipun',
            colour: '#000000',
            count: gradeStudents[grade.toString()].not_nipun
          },
          {
            label: 'Not assessed',
            colour: '#000000',
            count: (gradeStudents[grade.toString()].students.length - gradeStudents[grade.toString()].nipun - gradeStudents[grade.toString()].not_nipun)
          }
        ],
        students: gradeStudents[grade.toString()].students
      });
    }
    return response;
  }

  async getSchoolStudentsResultsSummary(mentor: Mentor, udise: number, grades: Array<Number>, xMonths: number = 12) {
    // find out all the months for which we wanted to fetch summary data for
    const globalStartDate = moment('2023-09-01');  // the date post which this feature was made live
    let startDate = moment(globalStartDate).subtract(xMonths, 'months').startOf('month');
    const now = moment();
    const monthsForQuery: Array<{year: number, month: number}> = [];
    while (startDate < now) {
      if (startDate >= globalStartDate) {
        // this is the month we shall consider
        monthsForQuery.push({ year: startDate.year(), month: startDate.month() });
      }
      if (startDate > now) {
        break;
      }
      startDate = startDate.add('1', 'month');
    }

    const query = `
      select t.grade,
        count(t.student_id)                                        as assessed,
        count(case when t.is_passed is true then t.student_id end) as nipun
      from (
        select distinct on (avrs.student_id) student_id,
          avrs.grade,
          avrs.created_at,
          avrs.is_passed
        from %table_student% avrs 
        join %table_v2% avr2 on (
          avrs.assessment_visit_results_v2_id = avr2.id and avr2.udise = ${udise}
        )
        where avrs.student_id is not null
          and avrs.submission_timestamp > %start_time%
          and avrs.submission_timestamp < %end_time%
          and avrs.grade in (%grades%)
         order by avrs.student_id, avrs.created_at DESC
           ) t
      group by grade;
    `;

    const gradeWiseSummary: Record<string, any> = {};
    let summaries: Record<string, object> = {};
    monthsForQuery.forEach(item => {
      const monthName = moment().month(item.month).year(item.year).date(1).format('MMMM');
      summaries[monthName] = {
        period: monthName,
        total: 0,
        assessed: 0,
        successful: 0
      }
    })
    for (let grade of grades) {
      let summary = JSON.parse(JSON.stringify(summaries)); // we needed deep copy of `summaries` object
      const gradeTotal = await this.prismaService.students.count({
        where: {
          udise: udise,
          grade: parseInt(grade.toString())
        }
      });

      // set total for each summary object
      Object.entries(summary).forEach(key => {
        summary[key[0]].total = gradeTotal;
      })
      gradeWiseSummary[grade.toString()] = {
        grade: grade,
        summary: summary,
      }
    }
    for (const item of monthsForQuery) {
      const tables = this.getAssessmentVisitResultsTables(item.year, item.month+1);
      const result: Array<Record<string, number>> = await this.prismaService.$queryRawUnsafe(
        query
          .replace('%table_student%', tables.assessment_visit_results_students)
          .replace('%table_v2%', tables.assessment_visit_results_v2)
          .replace('%mentor_id%', mentor.id.toString())
          .replace('%start_time%', (moment().month(item.month).year(item.year).date(1).utc().startOf('day').unix() * 1000).toString())
          .replace('%end_time%', (moment().month(item.month+1).year(item.year).date(1).utc().startOf('day').unix() * 1000).toString())
          .replace('%grades%', grades.join(','))
      );
      for (const row of result) {
        gradeWiseSummary[row.grade.toString()].summary[moment().month(item.month).year(item.year).date(1).format('MMMM')].assessed = row.assessed;
        gradeWiseSummary[row.grade.toString()].summary[moment().month(item.month).year(item.year).date(1).format('MMMM')].successful = row.nipun;
      }
    }

    let response = Object.values(gradeWiseSummary); // remove grade keys from `gradeWiseSummary` object
    for (let item of response) {
      item.summary = Object.values(item.summary); // remove month name keys from summary objects
    }
    return response;
  }

  async getTeacherStudentsSummaryResultForPeriod(
    tables: TypeAssessmentQuarterTables,
    mentor: Mentor,
    udise: number,
    firstDayTimestamp: number,
    lastDayTimestamp: number): Promise<TypeTeacherHomeOverview | null> {
    try {
      const query = `
        select count(distinct student_id)                                     as assessments_total,
               count(distinct case when is_passed = true then student_id end) as nipun_total
        from (
          select distinct on (student_id) student_id,
                                         assessment_visit_results_v2_id
                                             submission_timestamp,
                                         is_passed
          from ${tables.assessment_visit_results_students} avrs
                  join ${tables.assessment_visit_results_v2} as avr2
                       on (avr2.id = avrs.assessment_visit_results_v2_id and avr2.actor_id = ${ActorEnum.TEACHER} and
                           avr2.assessment_type_id = ${AssessmentTypeEnum.NIPUN_ABHYAS} and avr2.udise = ${udise})
          where avrs.mentor_id = ${mentor.id}
           and avrs.student_id is not null
           and avrs.submission_timestamp > ${firstDayTimestamp}
           and avrs.submission_timestamp < ${lastDayTimestamp}
          order by student_id, submission_timestamp DESC
          ) t
      `;
      const result: Array<TypeTeacherHomeOverview> = await this.prismaService.$queryRawUnsafe(query);
      return {
        assessments_total: result[0].assessments_total,
        nipun_total: result[0].nipun_total
      };
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.handleRequestError(e);
    }
    return null;
  }

  async getSchoolTeacherPerformance(mentor: Mentor, udise: number) {
    const lastDate = new Date();  // it's now() basically
    const temp = new Date();
    const day = lastDate.getDay(), diff = lastDate.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    const firstDate = new Date(temp.setDate(diff));

    const tablesForFirstDate = this.getAssessmentVisitResultsTables(firstDate.getFullYear(), firstDate.getMonth() + 1);
    const tablesForLastDate = this.getAssessmentVisitResultsTables(lastDate.getFullYear(), lastDate.getMonth() + 1);

    let responseFirstTable: TypeTeacherHomeOverview | null;
    let responseSecondTable = null;
    if (tablesForFirstDate.assessment_visit_results_v2 === tablesForLastDate.assessment_visit_results_v2) {
      // both tables are same
      const firstDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0);
      const lastDayTimestamp = lastDate.getTime();

      responseFirstTable = await this.getTeacherStudentsSummaryResultForPeriod(
        tablesForFirstDate,
        mentor,
        udise,
        firstDayTimestamp,
        lastDayTimestamp
      );
    } else {
      // if the data needs to queried from two tables, we'll query for both separately
      let firstDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0);
      let lastDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth() + 1, 1, 0, 0, 0); // next month's first date
      responseFirstTable = await this.getTeacherStudentsSummaryResultForPeriod(
        tablesForFirstDate,
        mentor,
        udise,
        firstDayTimestamp,
        lastDayTimestamp
      );

      firstDayTimestamp = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), 1, 0, 0, 0);  // first day of current month
      lastDayTimestamp = lastDate.getTime();

      responseSecondTable = await this.getTeacherStudentsSummaryResultForPeriod(
        tablesForLastDate,
        mentor,
        udise,
        firstDayTimestamp,
        lastDayTimestamp
      );
    }
    let weekly = responseFirstTable;
    if (responseSecondTable) {
      // we need to merge both table's response
      weekly = {
        assessments_total: (responseFirstTable?.assessments_total || 0) + (responseSecondTable?.assessments_total || 0),
        nipun_total: (responseFirstTable?.nipun_total || 0) + (responseSecondTable?.nipun_total || 0),
      }
    }

    const currentMonthName = moment().utc().format('MMMM');
    const currentMonth = moment().utc().month() + 1;
    const currentYear = moment().utc().year();
    const currentMonthStartTimestamp = moment().utc().startOf('month').unix()*1000; // in milliseconds
    const currentMonthEndTimestamp = moment().utc().unix()*1000;  // in milliseconds
    const currentMonthTables = this.getAssessmentVisitResultsTables(currentYear, currentMonth);
    const currentMonthStats = await this.getTeacherStudentsSummaryResultForPeriod(
      currentMonthTables,
      mentor,
      udise,
      currentMonthStartTimestamp,
      currentMonthEndTimestamp
    );

    const lastMonthName = moment().utc().subtract(1, 'month').format('MMMM');
    const lastMonth = (currentMonth == 1) ? 12 : (currentMonth - 1);
    const lastYear = (currentMonth == 1) ? (currentYear - 1) : currentYear;
    const lastMonthStartTimestamp = moment().utc().subtract(1, 'month').startOf('month').unix()*1000; // in milliseconds
    const lastMonthEndTimestamp = moment().utc().subtract(1, 'month').endOf('month').unix()*1000; // in milliseconds
    const lastMonthTables = this.getAssessmentVisitResultsTables(lastYear, lastMonth);
    const lastMonthStats = await this.getTeacherStudentsSummaryResultForPeriod(
      lastMonthTables,
      mentor,
      udise,
      lastMonthStartTimestamp,
      lastMonthEndTimestamp
    );

    return [
      {
        period: "Weekly",
        insights: [
          {
            label: "Assessed students",
            count: weekly?.assessments_total ?? 0
          },
          {
            label: "Nipun students",
            count: weekly?.nipun_total ?? 0
          }
        ]
      },
      {
        period: currentMonthName,
        insights: [
          {
            label: "Assessed students",
            count: currentMonthStats?.assessments_total ?? 0
          },
          {
            label: "Nipun students",
            count: currentMonthStats?.nipun_total ?? 0
          }
        ]
      },
      {
        period: lastMonthName,
        insights: [
          {
            label: "Assessed students",
            count: lastMonthStats?.assessments_total ?? 0
          },
          {
            label: "Nipun students",
            count: lastMonthStats?.nipun_total ?? 0
          }
        ]
      }
    ];
  }
}
