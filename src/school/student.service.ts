import { Inject, Injectable, Logger } from '@nestjs/common';
import { CacheConstants, CacheKeySchoolStudentsCount, Student } from '../enums';
import { PrismaService } from '../prisma.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class StudentService {
  protected readonly logger = new Logger(StudentService.name);

  constructor(
    protected readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
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
    return await this.prismaService.$queryRaw`
    SELECT
      main.submission_timestamp,
      main.updated_at,
      main.isNipun,
      json_agg(
        json_build_object(
          'module', assessments.module,
          'nipun', assessments.is_passed,
          'achievement', assessments.achievement,
          'statement', assessments.statement,
          'result', assessments.results_json
        )
      ) AS history
    FROM (
      SELECT
        a.submission_timestamp,
        a.updated_at,
        EVERY(a.is_passed) AS isNipun
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
    GROUP BY main.submission_timestamp, main.updated_at, main.isNipun
    ORDER BY main.submission_timestamp DESC
  `;
  }
}
