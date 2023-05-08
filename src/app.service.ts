import {
  BadRequestException, CACHE_MANAGER, Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateAssessmentVisitResult } from './dto/CreateAssessmentVisitResult.dto';
import { Prisma } from '@prisma/client';
import { CreateAssessmentSurveyResult } from './dto/CreateAssessmentSurveyResult.dto';
import { AssessmentVisitResultsStudentModule, CacheConstants, Mentor } from './enums';
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

  private getAssessmentVisitResultsTables(year: null | number = null, month: null | number = null): {
    assessment_visit_results_v2: string,
    assessment_visit_results_students: string,
    assessment_visit_results_student_odk_results: string,
  } {
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
    const submissionDate = new Date(createAssessmentVisitResultData.submission_timestamp)
    const tables = this.getAssessmentVisitResultsTables(submissionDate.getFullYear(), submissionDate.getMonth() + 1); // since getMonth() gives month's index
    try {
      return await this.prismaService.$transaction(async (tx) => {
        // Checking if Assessment visit result already exist; if not then creating it
        // @ts-ignore
        let assessmentVisitResult = await tx[tables.assessment_visit_results_v2].findFirst({
          select: {
            id: true
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

        if (!assessmentVisitResult) {
          // @ts-ignore
          assessmentVisitResult = await tx[tables.assessment_visit_results_v2].create({
            select: {
              id: true
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

        // filtering student whose module is 'odk'
        const assessmentVisitResultStudents =
          createAssessmentVisitResultData.results.filter(
            (result) =>
              result.module === AssessmentVisitResultsStudentModule.ODK,
          );

        for (const student of assessmentVisitResultStudents) {
          // Checking if Assessment visit result student already exist; if not then creating it
          // @ts-ignore
          let assessmentVisitResultStudent = await tx[tables.assessment_visit_results_students].findFirst({
            // TODO instead of find first use exists() or count() query instead
            select: {
              id: true
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

          const assessmentVisitResultStudentId =
            assessmentVisitResultStudent.id;

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
    const tables = this.getAssessmentVisitResultsTables(year, month);
    const mentorId = Number(mentor.id);
    const firstDayTimestamp = Date.UTC(year, month - 1, 1, 0, 0, 0);  // first day of current month
    const lastDayTimestamp = Date.UTC(year, month, 1, 0, 0, 0); // first day of next month
    try {
      return await this.prismaService.$queryRawUnsafe(`SELECT 
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

      return {
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
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.handleRequestError(e);
    }
  }

  async findMentorByPhoneNumber(phoneNumber: string): Promise<Mentor | null> {
    // We'll check if there is Mentor in the cache
    const cachedData = await this.cacheService.get<Mentor | null>(
      phoneNumber,
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
        phone_no: true,
        district_id: true,
        block_id: true,
      },
    });
    await this.cacheService.set(phoneNumber, mentor, CacheConstants.TTL_MENTOR_FROM_TOKEN); // Adding the mentor to cache
    return mentor;
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
