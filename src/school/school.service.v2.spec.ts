import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { AppService } from '../app.service';
import { CacheModule } from '@nestjs/common';
import { FusionauthService } from '../fusionauth.service';
import { RedisHelperService } from '../RedisHelper.service';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { JwtService } from '@nestjs/jwt';
import { SchoolServiceV2 } from './school.service.v2';
import { StudentService } from './student.service';
import * as path from 'path';
import { I18nModule } from 'nestjs-i18n';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { addMockStudentAssessmentData } from '../utils/test-utils';
import { assessment_cycle_school_nipun_results } from '@prisma/client';

class MockRedisService {
  getClient(): Promise<any> {
    return Promise.resolve();
  }
}

describe('SchoolServiceV2', () => {
  let schoolServicev2: SchoolServiceV2;
  let prismaService: PrismaService;
  let configService: ConfigService;
  const UDISE = 9151714447; // TODO: make this more dynamic, make cycles at runtime
  const CYCLE_ID = 13;
  const MENTOR = {id: 375857, phoneNo: 8668727053, district_id: 2}
  const EXAMINER_ID = 2;
  const GRADES = [1, 2, 3]
  const BLOCK_ID = 4; // for district 2


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        I18nModule.forRoot({
          fallbackLanguage: 'en',
          loaderOptions: {
            path: path.join(__dirname, '../i18n/'),
            watch: true,
          },
        }),
        ConfigModule.forRoot({
          ignoreEnvVars: true,
          envFilePath: 'test.env',
          isGlobal: true
        }),
      ],
      providers: [ 
        SchoolServiceV2,
        PrismaService,
        FusionauthService,
        RedisHelperService,
        StudentService,
        ConfigService,
        AppService,
        RedisService,
        {
          provide: RedisService,
          useClass: MockRedisService
        },
        JwtService,
      ],
    })
    .compile();

    schoolServicev2 = module.get<SchoolServiceV2>(SchoolServiceV2);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  // Samagra Test user is created and pre-seeded to the test database
  // Cycle 13 is seeded to be used for testing
  // 1 school is mapped to it and no assessments are conducted so far
  it('should be defined', async () => {
    expect(schoolServicev2).toBeDefined();
  });

  it('school should be nipun when "nipun" criteria is met', async () => {
    // Transactions will only work for all queryRaw operations only
    await prismaService.$queryRaw`BEGIN TRANSACTION`
    // GIVEN 
    // Get cycle details from DB
    const cycleDetails = await prismaService.assessment_cycles.findFirstOrThrow({where: {id: configService.get('TEST_CYCLE_ID', 13)}});
    const studentCycleGradeMapping = await prismaService.assessment_cycle_district_school_mapping.findFirst({
      where: {
        cycle_id: CYCLE_ID,
        udise: UDISE // Hardcoded for now TODO: Map cycle at random
      }
    })
    
    // WHEN Assessments for all classes are done!
    // randomly select students and create passed assessments until class is nipun
    for (let i = 0; i < GRADES.length; i++) {
      const grade = GRADES[i];

      // @ts-ignore
      const numberOfStudentsThatShouldPass = Math.ceil(cycleDetails[`class_${grade}_nipun_percentage` as unknown as assessment_cycles] * cycleDetails[`class_${grade}_students_count`] / 100);
      // @ts-ignore
      const randomstudentIDstoPass = studentCycleGradeMapping[`class_${grade}_students`]?.toLocaleString().split(',').sort(() => Math.random() - Math.random()).slice(0, numberOfStudentsThatShouldPass);
      
      for(let s = 0; s < randomstudentIDstoPass.length; s++) {
        const studentId = randomstudentIDstoPass[s];

        const result = await schoolServicev2.calculateExaminerCycleUdiseResult(MENTOR.id, CYCLE_ID, UDISE) as assessment_cycle_school_nipun_results
        // school should not be nipun till the last student is assessed
        expect(result.is_nipun).toBe(false)

        await addMockStudentAssessmentData(prismaService, grade, UDISE, MENTOR.id, EXAMINER_ID, true, BLOCK_ID, studentId)
      }

    }

    // all students assessed, now calculate nipun
    const result = await schoolServicev2.calculateExaminerCycleUdiseResult(MENTOR.id, CYCLE_ID, UDISE) as assessment_cycle_school_nipun_results
    
    // THEN school should be NIPUN
    expect(result.is_nipun).toBe(true)

    // Rollback transaction, but queries using `queryRaw` ONLY ROLLS BACK
    // TODO: Move to test containers
    await prismaService.$queryRaw`ROLLBACK`
  }, 10000);
});
