import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateAssessmentVisitResult } from './dto/CreateAssessmentVisitResult.dto';

@Injectable()
export class AppService {
  constructor(private readonly prismaService: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async createAssessmentVisitResult(
    createAssessmentVisitResultData: CreateAssessmentVisitResult,
  ): Promise<any> {
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

      this.prismaService.$transaction(async (tx) => {
        // Checking if Assessment visit result already exist; if not then creating it
        let assessmentVisitResult =
          await tx.assessment_visit_results_v2.findFirst({
            where: {
              submission_date: {
                gte: startOfMonthDate,
                lte: endOfMonthDate,
              },
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
        createAssessmentVisitResultData.students
          .filter((student) => student.module === 'odk')
          .forEach(async (student) => {
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
          });

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
              odk_results: [],
            };
          });

        await tx.assessment_visit_results_students.createMany({
          data: nonOdkModuleStudents,
          skipDuplicates: true,
        });
      });

      console.log('asdsad');
    } catch (e) {
      console.log('eroror has occured');
    }
  }
}
