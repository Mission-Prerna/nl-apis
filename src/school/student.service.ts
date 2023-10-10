import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import { CacheConstants, CacheKeySchoolStudentsCount, Student } from '../enums';
import { PrismaService } from '../prisma.service';
import { Cache } from 'cache-manager';

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
    const results: Array<{ grade: number, count: number }> = await this.prismaService.$queryRawUnsafe(`select grade, count(*) as count from students where udise = ${udise} group by grade`);

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
}
