import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateAssessmentVisitResult } from './dto/CreateAssessmentVisitResult.dto';
import { Prisma } from '@prisma/client';
import { CreateAssessmentSurveyResult } from './dto/CreateAssessmentSurveyResult.dto';
import { AssessmentVisitResultsStudentModule, Mentor } from './enums';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createAssessmentVisitResult(
    createAssessmentVisitResultData: CreateAssessmentVisitResult,
  ) {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        // Checking if Assessment visit result already exist; if not then creating it
        let assessmentVisitResult =
          await tx.assessment_visit_results_v2.findFirst({
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
          assessmentVisitResult = await tx.assessment_visit_results_v2.create({
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
          let assessmentVisitResultStudent =
            await tx.assessment_visit_results_students.findFirst({
              // TODO instead of find first use exists() or count() query instead
              where: {
                competency_id: student.competency_id,
                student_session: student.student_session,
                assessment_visit_results_v2_id: assessmentVisitResult.id,
              },
            });

          if (assessmentVisitResultStudent) {
            // Assessment visit result student exist; delete its odk submissions
            await tx.assessment_visit_results_student_odk_results.deleteMany({
              where: {
                assessment_visit_results_students_id:
                  assessmentVisitResultStudent.id,
              },
            });
          } else {
            assessmentVisitResultStudent =
              await tx.assessment_visit_results_students.create({
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
          await tx.assessment_visit_results_student_odk_results.createMany({
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
        await tx.assessment_visit_results_students.createMany({
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
    const mentorId = Number(mentor.id);
    const firstDayTimestamp = Date.UTC(year, month - 1, 1, 0, 0, 0);
    const lastDayTimestamp = Date.UTC(year, month, 0, 23, 59, 59);
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
        (case when EXISTS(SELECT avr2.id from assessment_visit_results_v2 as avr2 
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
          submission_timestamp: true,
          grade: true,
          actor_id: true,
          mentor_id: true,
          subject_id: true,
          udise: true,
          created_at: true,
          assessment_survey_result_questions: true,
          app_version_code: true,
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
    const firstDayTimestamp = Date.UTC(year, month - 1, 1, 0, 0, 0);
    const lastDayTimestamp = Date.UTC(year, month, 0, 23, 59, 59);

    try {
      const result: Record<string, any> = await this.prismaService
        .$queryRaw(Prisma.sql`
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
                      assessment_visit_results_v2 as avr2
                  where
                      avr2.mentor_id = ${mentor.id}
                      and avr2.submission_timestamp > ${firstDayTimestamp} 
                      and avr2.submission_timestamp < ${lastDayTimestamp}
              ) as a,
              (
                  select
                      COALESCE(AVG(avrs.total_time_taken), 0) as average_assessment_time
                  from
                      assessment_visit_results_students as avrs
                  where
                      avrs.assessment_visit_results_v2_id in (
                          select
                              avr2.id
                          from
                              assessment_visit_results_v2 as avr2
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
                      assessment_visit_results_students as avrs
                  where
                      avrs.assessment_visit_results_v2_id in (
                          select
                              avr2.id
                          from
                              assessment_visit_results_v2 as avr2
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
                      assessment_visit_results_students as avrs
                  where
                      avrs.assessment_visit_results_v2_id in (
                          select
                              avr2.id
                          from
                              assessment_visit_results_v2 as avr2
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
                      assessment_visit_results_students as avrs
                  where
                      avrs.assessment_visit_results_v2_id in (
                          select
                              avr2.id
                          from
                              assessment_visit_results_v2 as avr2
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
                      assessment_visit_results_students as avrs
                  where
                      avrs.assessment_visit_results_v2_id in (
                          select
                              avr2.id
                          from
                              assessment_visit_results_v2 as avr2
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
    return await this.prismaService.mentor.findFirst({
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
