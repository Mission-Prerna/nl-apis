import {
  BadRequestException,
  CACHE_MANAGER,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
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
  CacheKeyActorHomeOverview,
  CacheKeyMentorDetail,
  CacheKeyMentorHomeOverview,
  CacheKeyMentorSchoolList,
  Mentor,
  TypeActorHomeOverview,
  TypeAssessmentQuarterTables,
} from './enums';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {
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
    return {
      assessment_visit_results_v2: `assessment_visit_results_v2_${year.toString()}_${quarter}`,
      assessment_visit_results_students: `assessment_visit_results_students_${year.toString()}_${quarter}`,
      assessment_visit_results_student_odk_results: `assessment_visit_results_student_odk_results_${year.toString()}_${quarter}`,
    };
  }

  async createAssessmentVisitResult(
    createAssessmentVisitResultData: CreateAssessmentVisitResult,
  ) {
    const submissionDate = new Date(createAssessmentVisitResultData.submission_timestamp);
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

      // filtering student whose module is 'odk'
      const assessmentVisitResultStudents =
        createAssessmentVisitResultData.results.filter(
          (result) =>
            result.module === AssessmentVisitResultsStudentModule.ODK,
        );

      return await this.prismaService.$transaction(async (tx) => {
        if (!assessmentVisitResult) {
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
        }

        const assessmentVisitResultId = assessmentVisitResult.id;

        for (const student of assessmentVisitResultStudents) {
          // Checking if Assessment visit result student already exist; if not then creating it
          // @ts-ignore
          let assessmentVisitResultStudent = await tx[tables.assessment_visit_results_students].findFirst({
            select: {
              id: true,
            },
            where: {
              competency_id: student.competency_id,
              student_session: student.student_session,
              assessment_visit_results_v2_id: assessmentVisitResult.id,
            },
          });

          if (assessmentVisitResultStudent) {
            // Assessment visit result student exist; delete its odk submissions
            // @ts-ignore
            await tx[tables.assessment_visit_results_student_odk_results].deleteMany({
              where: {
                assessment_visit_results_students_id:
                assessmentVisitResultStudent.id,
              },
            });
          } else {
            // @ts-ignore
            assessmentVisitResultStudent = await tx[tables.assessment_visit_results_students].create({
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
              },
            });
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
            };
          });

        // noinspection TypeScriptValidateJSTypes
        // @ts-ignore
        await tx[tables.assessment_visit_results_students].createMany({
          data: nonOdkModuleStudents,
          skipDuplicates: true,
        });
        return assessmentVisitResult;
      }, {
        timeout: 15000,
      });
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
        end) as is_visited
      from school_list as s
      join districts d on d.id = s.district_id
      join blocks b on b.id = s.block_id
      left join nyay_panchayats n on n.id = s.nyay_panchayat_id
      where s.district_id = ${mentor.district_id}
      ${mentor.block_id ? `and s.block_id = ${mentor.block_id}` : ''}`);
      await this.cacheService.set(CacheKeyMentorSchoolList(mentor.phone_no, month, year), response, CacheConstants.TTL_MENTOR_SCHOOL_LIST); // Adding the data to cache
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

  async getHomeScreenMetric(mentor: Mentor, month: number, year: number) {
    // We'll check if there is data in the cache
    const cachedData = await this.cacheService.get<any>(
      CacheKeyMentorHomeOverview(mentor.phone_no, month, year),
    );
    if (cachedData) {
      return cachedData;
    }

    const tables = this.getAssessmentVisitResultsTables(year, month);
    const firstDayTimestamp = Date.UTC(year, month - 1, 1, 0, 0, 0);  // first day of current month
    const lastDayTimestamp = Date.UTC(year, month, 1, 0, 0, 0); // 1st day of next month

    try {
      const result: Record<string, any> = await this.prismaService
        .$queryRawUnsafe(`
          select
              a.visited_schools,
              b.average_assessment_time :: int8,
              c.total_assessments,
              d.grade1_assessments,
              e.grade2_assessments,
              f.grade3_assessments
          from
              (
                  select
                      count(DISTINCT udise) as visited_schools
                  from
                      ${tables.assessment_visit_results_v2} as avr2
                  where
                      avr2.mentor_id = ${mentor.id}
                      and avr2.udise > 0
                      and avr2.submission_timestamp > ${firstDayTimestamp} 
                      and avr2.submission_timestamp < ${lastDayTimestamp}
              ) as a,
              (
                  select
                      COALESCE(AVG(avrs.total_time_taken), 0) as average_assessment_time
                  from
                      ${tables.assessment_visit_results_students} as avrs
                  where
                      avrs.assessment_visit_results_v2_id in (
                          select
                              avr2.id
                          from
                              ${tables.assessment_visit_results_v2} as avr2
                          where
                              avr2.mentor_id = ${mentor.id}
                              and avr2.submission_timestamp > ${firstDayTimestamp} 
                              and avr2.submission_timestamp < ${lastDayTimestamp}
                      )
              ) as b,
              (
                  select
                      count(*) as total_assessments
                  from
                      ${tables.assessment_visit_results_students} as avrs
                  where
                      avrs.assessment_visit_results_v2_id in (
                          select
                              avr2.id
                          from
                              ${tables.assessment_visit_results_v2} as avr2
                          where
                              avr2.mentor_id = ${mentor.id}
                              and avr2.submission_timestamp > ${firstDayTimestamp} 
                              and avr2.submission_timestamp < ${lastDayTimestamp}
                      )
              ) as c,
              (
                  select
                      count(*) as grade1_assessments
                  from
                      ${tables.assessment_visit_results_students} as avrs
                  where
                      avrs.assessment_visit_results_v2_id in (
                          select
                              avr2.id
                          from
                              ${tables.assessment_visit_results_v2} as avr2
                          where
                              avr2.grade = 1
                              and avr2.mentor_id = ${mentor.id}
                              and avr2.submission_timestamp > ${firstDayTimestamp} 
                              and avr2.submission_timestamp < ${lastDayTimestamp}
                      )
              ) as d,
              (
                  select
                      count(*) as grade2_assessments
                  from
                      ${tables.assessment_visit_results_students} as avrs
                  where
                      avrs.assessment_visit_results_v2_id in (
                          select
                              avr2.id
                          from
                              ${tables.assessment_visit_results_v2} as avr2
                          where
                              avr2.grade = 2
                              and avr2.mentor_id = ${mentor.id}
                              and avr2.submission_timestamp > ${firstDayTimestamp} 
                              and avr2.submission_timestamp < ${lastDayTimestamp}
                      )
              ) as e,
              (
                  select
                      count(*) as grade3_assessments
                  from
                      ${tables.assessment_visit_results_students} as avrs
                  where
                      avrs.assessment_visit_results_v2_id in (
                          select
                              avr2.id
                          from
                              ${tables.assessment_visit_results_v2} as avr2
                          where
                              avr2.grade = 3
                              and avr2.mentor_id = ${mentor.id}
                              and avr2.submission_timestamp > ${firstDayTimestamp} 
                              and avr2.submission_timestamp < ${lastDayTimestamp}
                      )
              ) as f`);

      const response = {
        visited_schools: result[0]['visited_schools'],
        total_assessments: result[0]['total_assessments'],
        average_assessment_time: result[0]['average_assessment_time'],
        grades: [
          {
            grade: 1,
            total_assessments: result[0]['grade1_assessments'],
          },
          {
            grade: 2,
            total_assessments: result[0]['grade2_assessments'],
          },
          {
            grade: 3,
            total_assessments: result[0]['grade3_assessments'],
          },
        ],
      };
      await this.cacheService.set(CacheKeyMentorHomeOverview(mentor.phone_no, month, year), response, CacheConstants.TTL_MENTOR_HOME_OVERVIEW); // Adding the data to cache
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
    await this.cacheService.set(CacheKeyMentorDetail(phoneNumber), temp, CacheConstants.TTL_MENTOR_FROM_TOKEN); // Adding the mentor to cache
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
    return {
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
      }
    });
  }

  async getActorHomeScreenRawQueryResult(
    tables: TypeAssessmentQuarterTables,
    mentor: Mentor,
    firstDayTimestamp: number,
    lastDayTimestamp:number): Promise<TypeActorHomeOverview|null> {
    try {
      const result: Record<string, any> = await this.prismaService
        .$queryRawUnsafe(`
            select a.total_assessments_7_days, c.nipun_7_days, b.total_assessments_today, d.nipun_today from
              (
                select
                  count(distinct student_session) as total_assessments_7_days
                from
                  ${tables.assessment_visit_results_students} as avrs
                where
                  avrs.assessment_visit_results_v2_id in (
                    select
                      avr2.id
                    from
                      ${tables.assessment_visit_results_v2} as avr2
                    where
                      avr2.mentor_id = ${mentor.id}
                      and avr2.actor_id = ${ActorEnum.TEACHER}
                      and avr2.assessment_type_id = ${AssessmentTypeEnum.NIPUN_ABHYAS}
                      and avr2.submission_timestamp > ${firstDayTimestamp}
                      and avr2.submission_timestamp < ${lastDayTimestamp}
                   )
              ) as a,
              (
                select
                  count(distinct student_session) as total_assessments_today
                from
                  ${tables.assessment_visit_results_students} as avrs
                where
                  avrs.assessment_visit_results_v2_id in (
                    select
                      avr2.id
                    from
                      ${tables.assessment_visit_results_v2} as avr2
                    where
                      avr2.mentor_id = ${mentor.id}
                      and avr2.actor_id = ${ActorEnum.TEACHER}
                      and avr2.assessment_type_id = ${AssessmentTypeEnum.NIPUN_ABHYAS}
                      and avr2.submission_timestamp > ${firstDayTimestamp}
                      and avr2.submission_timestamp < ${lastDayTimestamp}
                  )
              ) as b,
              (
                select
                  count(distinct student_session) as nipun_7_days
                from
                  ${tables.assessment_visit_results_students} as avrs
                where
                  avrs.assessment_visit_results_v2_id in (
                    select
                      avr2.id
                    from
                      ${tables.assessment_visit_results_v2} as avr2
                    where
                      avr2.mentor_id = ${mentor.id}
                      and avr2.actor_id = ${ActorEnum.TEACHER}
                      and avr2.assessment_type_id = ${AssessmentTypeEnum.NIPUN_ABHYAS}
                      and avr2.submission_timestamp > ${firstDayTimestamp}
                      and avr2.submission_timestamp < ${lastDayTimestamp}
                    ) and avrs.is_passed = true
              ) as c,
              (
                select
                  count(distinct student_session) as nipun_today
                from
                  ${tables.assessment_visit_results_students} as avrs
                where
                  avrs.assessment_visit_results_v2_id in (
                    select
                      avr2.id
                    from
                      ${tables.assessment_visit_results_v2} as avr2
                    where
                      avr2.mentor_id = ${mentor.id}
                      and avr2.actor_id = ${ActorEnum.TEACHER}
                      and avr2.assessment_type_id = ${AssessmentTypeEnum.NIPUN_ABHYAS}
                      and avr2.submission_timestamp > ${firstDayTimestamp}
                      and avr2.submission_timestamp < ${lastDayTimestamp}
                  ) and avrs.is_passed = true
              ) as d
          `);

      return {
        total_assessments_7_days: result[0]['total_assessments_7_days'],
        nipun_7_days: result[0]['nipun_7_days'],
        total_assessments_today: result[0]['total_assessments_today'],
        nipun_today: result[0]['nipun_today'],
      };
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.handleRequestError(e);
    }
    return null;
  }

  async getActorHomeScreenMetric(mentor: Mentor) {
    const lastDate = new Date();  // it's now() basically
    // We'll check if there is data in the cache
    const cachedData = await this.cacheService.get<any>(
      CacheKeyActorHomeOverview(mentor.phone_no, mentor.actor_id, lastDate.getDate()),
    );
    if (cachedData) {
      return cachedData;
    }

    const temp = new Date();
    const day = lastDate.getDay(), diff = lastDate.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
    const firstDate = new Date(temp.setDate(diff));

    const tablesForFirstDate = this.getAssessmentVisitResultsTables(firstDate.getFullYear(), firstDate.getMonth()+1);
    const tablesForLastDate = this.getAssessmentVisitResultsTables(lastDate.getFullYear(), lastDate.getMonth()+1);

    let responseFirstTable: TypeActorHomeOverview|null;
    let responseSecondTable = null;
    if (tablesForFirstDate.assessment_visit_results_v2 === tablesForLastDate.assessment_visit_results_v2) {
      // both tables are same
      const firstDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0);
      const lastDayTimestamp = lastDate.getTime();

      responseFirstTable = await this.getActorHomeScreenRawQueryResult(
        tablesForFirstDate,
        mentor,
        firstDayTimestamp,
        lastDayTimestamp
      );
    } else {
      // if the data needs to queried from two tables, we'll query for both separately
      let firstDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0);
      let lastDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth() + 1, 1, 0, 0, 0); // next month's first date
      responseFirstTable = await this.getActorHomeScreenRawQueryResult(
        tablesForFirstDate,
        mentor,
        firstDayTimestamp,
        lastDayTimestamp
      );

      firstDayTimestamp = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), 1, 0, 0, 0);  // first day of current month
      lastDayTimestamp = lastDate.getTime();

      responseSecondTable = await this.getActorHomeScreenRawQueryResult(
        tablesForLastDate,
        mentor,
        firstDayTimestamp,
        lastDayTimestamp
      );
    }
    let response = responseFirstTable;
    if (responseSecondTable) {
      // we need to merge both table's response
      response = {
        total_assessments_7_days: (responseFirstTable?.total_assessments_7_days || 0) + (responseSecondTable?.total_assessments_7_days || 0),
        nipun_7_days: (responseFirstTable?.nipun_7_days || 0) + (responseSecondTable?.nipun_7_days || 0),
        total_assessments_today: (responseFirstTable?.total_assessments_today || 0) + (responseSecondTable?.total_assessments_today || 0),
        nipun_today: (responseFirstTable?.nipun_today || 0) + (responseSecondTable?.nipun_today || 0)
      }
    }
    await this.cacheService.set(CacheKeyActorHomeOverview(mentor.phone_no, mentor.actor_id, lastDate.getDate()), response, CacheConstants.TTL_ACTOR_HOME_OVERVIEW); // Adding the data to cache
    return response;
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
}
