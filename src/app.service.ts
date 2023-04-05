import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateAssessmentVisitResult } from './dto/CreateAssessmentVisitResult.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async createAssessmentVisitResult(
    createAssessmentVisitResultData: CreateAssessmentVisitResult,
  ) {
    try {
      const submissionDate = new Date(
        createAssessmentVisitResultData.submission_date,
      );
      const startOfMonthDate = new Date(
        Date.UTC(submissionDate.getFullYear(), submissionDate.getMonth(), 1),
      );
      const endOfMonthDate = new Date(
        Date.UTC(
          submissionDate.getFullYear(),
          submissionDate.getMonth() + 1,
          0,
        ),
      );

      await this.prismaService.$transaction(async (tx) => {
        // Checking if Assessment visit result already exist; if not then creating it
        let assessmentVisitResult =
          await tx.assessment_visit_results_v2.findFirst({
            where: {
              submission_date: {
                gte: startOfMonthDate,
                lte: endOfMonthDate,
              },
              mentor_id: createAssessmentVisitResultData.mentor_id,
              grade: createAssessmentVisitResultData.grade,
              subject_id: createAssessmentVisitResultData.subject_id,
            },
          });

        if (!assessmentVisitResult) {
          assessmentVisitResult = await tx.assessment_visit_results_v2.create({
            data: {
              submission_date: submissionDate,
              grade: createAssessmentVisitResultData.grade,
              subject_id: createAssessmentVisitResultData.subject_id,
              mentor_id: createAssessmentVisitResultData.mentor_id,
              actor_id: createAssessmentVisitResultData.actor_id,
              block_id: createAssessmentVisitResultData.block_id,
              assessment_type_id:
                createAssessmentVisitResultData.assessment_type_id,
              udise: createAssessmentVisitResultData.udise,
              no_of_student: createAssessmentVisitResultData.no_of_student,
              module_result: {},
            },
          });
        }

        // filtering student whose module is 'odk'
        const assessmentVisitResultStudents =
          createAssessmentVisitResultData.students.filter(
            (student) => student.module === 'odk',
          );

        for (const student of assessmentVisitResultStudents) {
          // Checking if Assessment visit result student already exist; if not then creating it
          let assessmentVisitResultStudent =
            await tx.assessment_visit_results_students.findFirst({
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
                  app_version_code: student.app_version_code,
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

          // creating multiple Assessment visit results student odk results
          await tx.assessment_visit_results_student_odk_results.createMany({
            data: student.odk_results.map((odkResult) => {
              return {
                question: odkResult.question,
                answer: odkResult.answer,
                assessment_visit_results_students_id:
                  assessmentVisitResultStudent.id,
              };
            }),
            skipDuplicates: true,
          });
        }

        // filtering student whose module is not 'odk'
        const nonOdkModuleStudents = createAssessmentVisitResultData.students
          .filter((student) => student.module !== 'odk')
          .map((student) => {
            return {
              student_name: student.student_name,
              competency_id: student.competency_id,
              module: student.module,
              end_time: student.end_time,
              is_passed: student.is_passed,
              start_time: student.start_time,
              statement: student.statement,
              achievement: student.achievement,
              app_version_code: student.app_version_code,
              total_questions: student.total_questions,
              success_criteria: student.success_criteria,
              session_completed: student.session_completed,
              is_network_active: student.is_network_active,
              workflow_ref_id: student.workflow_ref_id,
              total_time_taken: student.total_time_taken,
              student_session: student.student_session,
              assessment_visit_results_v2_id: assessmentVisitResult.id,
            };
          });

        await tx.assessment_visit_results_students.createMany({
          data: nonOdkModuleStudents,
          skipDuplicates: true,
        });
      });
    } catch (e) {
      this.logger.error(`Prisma error: ${e}`);
      throw new InternalServerErrorException();
    }
  }

  async getMentorSchoolListIfHeHasVisited(
    mentorPhoneNumber: string,
    month: number,
    year: number,
  ) {
    try {
      return await this.prismaService.$queryRaw(Prisma.sql`SELECT 
        s.id as school_id,
        s."name" as school_name, 
        s.udise,
        d.name as district_name,
        b.name as block_name,
        s.nypanchayat as nypanchayat,
        (case when EXISTS(SELECT avr2.id from assessment_visit_results_v2 as avr2 
            where avr2.udise = 	s.udise 
            and EXTRACT(MONTH from avr2.submission_date) = ${month} 
            and EXTRACT(YEAR FROM avr2.submission_date) = ${year})
          THEN true 
          ELSE false
        end) as is_visited
      from school_list as s
      join districts d on d.id = s.district_id
      join blocks b on b.id = s.block_id
      join mentor m on m.district_id = d.id and m.block_id = b.id
      where m.phone_no = ${mentorPhoneNumber}`);
    } catch (e) {
      this.logger.error(`Prisma error: ${e}`);
      throw new InternalServerErrorException();
    }
  }
}
