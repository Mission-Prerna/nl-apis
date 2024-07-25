import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheConstants, CacheKeySchoolStudentsCount, Student } from '../enums';
import { PrismaService } from '../prisma.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { CONSTANTS } from 'src/utils/constants';
import { fetchQuestionsByIds } from 'src/utils/nisai.service';

@Injectable()
export class StudentService {
  protected readonly logger = new Logger(StudentService.name);

  constructor(
    protected readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
    protected readonly i18n: I18nService,
  ) {
  }

  async getGradeStudentsCount(udise: number, cache: boolean = true): Promise<Array<{ grade: number, count: number }>> {
    if (cache) {
      const cachedData = await this.cacheService.get<Array<{ grade: number, count: number }>>(
        CacheKeySchoolStudentsCount(udise),
      );
      if (cachedData) {
        return cachedData;
      }
    }
    const results: Array<{ grade: number, count: number }> = await this.prismaService.$queryRawUnsafe(`select grade, count(*) as count from students where udise = $1 group by grade`, udise);

    // @ts-ignore
    this.cacheService.set(CacheKeySchoolStudentsCount(udise), results, {
      ttl: CacheConstants.TTL_SCHOOL_STUDENTS_COUNT,
    }).then(() => true); // Adding the data to cache
    return results;
  }

  async getSchoolStudents(udise: number): Promise<Array<Student>> {
    const response = await this.prismaService.students.findMany({
      where: {
        udise: BigInt(parseInt(udise.toString())),
        grade: {
          in: [1, 2, 3],
        },
        unique_id: {
          notIn: ['-1', '-2', '-3'], // we don't want anonymous students
        },
        deleted_at: null,  // query only active students
      },
      select: {
        unique_id: true,
        name: true,
        grade: true,
        roll_no: true,
      },
    });
    return response.map((item) => {
      return {
        id: item.unique_id,
        name: item.name,
        grade: item.grade,
        roll_no: item.roll_no,
      };
    });
  }

  async getCycleStudents(udise: number, cycleId: number, grades: Array<number>): Promise<Array<Student>> {
    return this.prismaService.$queryRawUnsafe(`
      select s.unique_id as id, s.name, s.grade, s.roll_no
      from students s
               join assessment_cycle_district_school_mapping dsm on s.udise = dsm.udise and dsm.cycle_id = $1
      where s.udise = $2
        and grade = ANY($3::smallint[])
        and s.unique_id in
            (select jsonb_array_elements_text(dsm.class_1_students || dsm.class_2_students || dsm.class_3_students))    
    `, cycleId, udise, grades);
  }

  async getStudentAssessmentHistoryForMentor(
    student_id: string,
    mentor_id: number,
    limit: number,
    offset: number,
  ) {
    // Fetch student details
    const studentDetails = await this.getStudentDetails(student_id, mentor_id);

    // Fetch assessment history
    const assessmentHistory = await this.getStudentAssessmentHistory(
      student_id,
      mentor_id,
      limit,
      offset,
    );

    // Return combined result
    return {
      student_detail: studentDetails,
      assessment_history: assessmentHistory,
    };
  }

  async getStudentDetails(student_id: string, mentor_id: number) {
    const studentDetail: any = await this.prismaService.$queryRaw`
      SELECT
        s.name,
        s.udise,
        sl.district,
        COALESCE(MAX(a.submission_timestamp), null) AS last_assessment
      FROM students s
      LEFT JOIN school_list sl ON s.udise = sl.udise
      LEFT JOIN assessments a ON s.unique_id = a.student_id
      WHERE s.unique_id = ${student_id}
       AND s.deleted_at IS NULL
       AND a.mentor_id = ${mentor_id}
       AND a.is_valid = true
      GROUP BY s.name, s.udise, sl.district
    `;
    return studentDetail?.[0] || {};
  }

  async getStudentAssessmentHistory(
    student_id: string,
    mentor_id: number,
    limit: number,
    offset: number,
  ) {
    const queryResult: any = await this.prismaService.$queryRaw`
      SELECT
        main.submission_timestamp,
        main.updated_at,
        main.is_passed,
        json_agg(
          json_build_object(
            'is_passed', assessments.is_passed,
            'player_results', assessments.player_results,
            'result', assessments.results_json
          )
        ) AS competency_results
      FROM (
        SELECT
          a.submission_timestamp,
          a.updated_at,
          EVERY(a.is_passed) AS is_passed
        FROM assessments a
        JOIN students s ON a.student_id = s.unique_id
        WHERE
          a.student_id = ${student_id} AND
          a.mentor_id = ${mentor_id} AND
          a.is_valid = true AND  -- Pick only valid assessments
          s.deleted_at IS NULL   -- filter out deleted students
        GROUP BY a.submission_timestamp, a.updated_at
        ORDER BY a.submission_timestamp DESC
        LIMIT ${limit}
        OFFSET ${offset}
      ) AS main
      JOIN assessments ON main.submission_timestamp = assessments.submission_timestamp
      GROUP BY main.submission_timestamp, main.updated_at, main.is_passed
      ORDER BY main.submission_timestamp DESC
    `;

    // Use Promise.all to handle async operations within map
    const results = await Promise.all(
      queryResult.map(async (result: any) => {
        const competencyResults = await Promise.all(
          result.competency_results.map(async (assessment: any) => {
            const playerResults = assessment.player_results || {};
            const track = playerResults?.track || '';
            const type = playerResults?.assessment_type || '';
            const title = this.getCompetencyTitle(type, track);
            const wpm = playerResults?.results?.wpm || 0;
            const score = playerResults?.results?.scored || 0;
            const maxScore = playerResults?.results?.maxScore || 0;
            const achievement = this.getAchievement(type, score, maxScore, wpm);
            const result = playerResults?.results?.results || [];
            const questionAnswers = await this.getQuestionAnswerMapping(result);

            return {
              status: assessment.is_passed ? 'pass' : 'fail',
              track,
              type,
              achievement,
              title,
              transcript: playerResults?.results?.transcript || [],
              result: questionAnswers,
            };
          }),
        );

        return {
          submission_timestamp: result.submission_timestamp,
          status: result.is_passed ? 'pass' : 'fail',
          competency_results: competencyResults,
        };
      }),
    );

    return results || [];
  }

  async getQuestionAnswerMapping(results: any[]): Promise<any[]> {
    if (results.length === 0) return [];

    // Extract unique question IDs
    const questionIds = Array.from(
      new Set(results.map((result: any) => result.question)),
    );

    // Fetch question details for all unique question IDs
    const questions = await fetchQuestionsByIds(questionIds);

    // Map results to question details
    return results
      .map((result: any) => {
        const question = questions[result.question];
        if (!question) return null;

        // Find the choice that matches the answer ID (use this once answer id starts coming)
        // const choice = question.choices.find((c: any) => c.id === result.answer);

        // Get choice text and score based on the answer
        const choiceIndex = parseInt(result.answer, 10) - 1;
        const choice = question.choices[choiceIndex];
        const choiceText = choice ? choice.text : '';
        const score = choice ? choice.score : 0;

        return {
          question: question.text,
          answer: choiceText,
          score: score,
        };
      })
      .filter((mappedResult: any) => mappedResult !== null);
  }

  getCompetencyTitle(type: string, subject: string) {
    const lang: string = I18nContext?.current()?.lang ?? 'en';

    const title = {
      label:
        subject && subject !== ''
          ? this.i18n.t(`common.${subject.toUpperCase()}`, { lang: lang })
          : '',
      icon: '',
      sub_label: '',
    };

    if (type.toLowerCase() === 'verbal') {
      title.label = this.i18n.t(`common.READING_SPEED`, { lang: lang });
      title.icon = CONSTANTS.COMPETENCY_IMAGE.VERBAL;
      title.sub_label = this.i18n.t(`common.LIST_OF_WORDS`, { lang: lang });
    } else if (type.toLowerCase() !== 'verbal' && subject) {
      title.label =
        subject && subject !== ''
          ? this.i18n
              .t(`common.SUBJECT_QUESTION`, { lang: lang })
              .replace(
                '{subject}',
                this.i18n.t(`common.${subject.toUpperCase()}`, { lang: lang }),
              )
          : '';

      title.sub_label = this.i18n.t(`common.LIST_OF_QUESTIONS`, { lang: lang });

      subject.toLowerCase() === 'math'
        ? (title.icon = CONSTANTS.COMPETENCY_IMAGE.MATH)
        : (title.icon = CONSTANTS.COMPETENCY_IMAGE.HINDI);
    }

    return title;
  }

  getAchievement(type: string, score: number, maxScore: number, wpm: number) {
    const lang: string = I18nContext?.current()?.lang ?? 'en';
    if (type) {
      if (type.toLowerCase() === 'verbal')
        return this.i18n
          .t(`common.WPM_ACHIEVEMENT`, { lang: lang })
          .replace('{wpm}', `${wpm}`);

      return this.i18n
        .t(`common.SCORE_ACHIEVEMENT`, { lang: lang })
        .replace('{score}', `${score}`)
        .replace('{max_score}', `${maxScore}`);
    }
    return '';
  }
}
