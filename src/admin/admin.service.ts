import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import { FusionauthService } from '../fusionauth.service';
import { CreateMentorDto } from '../dto/CreateMentor.dto';
import { ActorEnum, CacheKeyMentorDetail, CacheKeyMentorMonthlyMetrics, CacheKeyMentorMonthlyMetricsV2, CacheKeyMentorMonthlyVisitedSchools, CacheKeyMentorSchoolList, CacheKeyMentorWeeklyMetrics, CacheKeyMetadata, CacheKeyMetadataAll } from '../enums';
import { MentorCreationFailedException } from '../exceptions/mentor-creation-failed.exception';
import { CreateMentorOldDto } from '../dto/CreateMentorOld.dto';
import { SchoolGeofencingBlacklistDto } from '../dto/SchoolGeofencingBlacklistDto';
import { GetAssessmentVisitResultsDto } from '../dto/GetAssessmentVisitResults.dto';
import { AppService } from '../app.service';
import { CreateStudent } from './dto/CreateStudent';
import { UpdateStudent } from './dto/UpdateStudent';
import { DeleteStudent } from './dto/DeleteStudent';
import { CreateAssessmentCycle } from './dto/CreateAssessmentCycle';
import { CreateAssessmentCycleDistrictSchoolMapping } from './dto/CreateAssessmentCycleDistrictSchoolMapping';
import { CreateAssessmentCycleDistrictExaminerMapping } from './dto/CreateAssessmentCycleDistrictExaminerMapping';
import { InvalidateExaminerCycleAssessmentsDto } from './dto/InvalidateExaminerCycleAssessments.dto';
import { Cache } from 'cache-manager';
import { CreateMentorSegmentRequest } from 'src/dto/CreateMentorSegmentRequest.dto';
import { StudentsUpdateResponse, StudentsUpdateResponseDto } from './dto/UpdateStudentsResponse.dto';
import { getPrismaErrorStatusAndMessage } from 'src/utils/utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as Sentry from '@sentry/minimal';
import { CreateUpdateSchoolBlacklistDto } from './dto/CreateSchoolBlacklist.dto';
import { CreateCompetencyDto } from './dto/CreateCompetency.dto';
import { CreateUpdateCwsnStudents } from './dto/CwsnStudents.dto';
import { InvalidateStudentAssessmentDto } from './dto/InvalidateStudentAssessment.dto';

@Injectable()
export class AdminService {
  protected readonly logger = new Logger(AdminService.name);

  constructor(
    protected readonly prismaService: PrismaService,
    protected readonly configService: ConfigService,
    protected readonly faService: FusionauthService,
    protected readonly appService: AppService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {
  }

  async createMentorOld(data: CreateMentorOldDto) {
    let blockId = null;
    if (!['examiner', 'SRG', 'Diet Mentor'].includes(data.designation) && !data.block_town_name) {
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
      is_active: data.is_active,
    };
    return this.createMentor(newDto);
  }

  async createMentor(data: CreateMentorDto) {
    try {
      const districtName = (await this.prismaService.districts.findUnique({ where: { id: data.district_id }}))?.name ?? null
      const blockName = (await this.prismaService.blocks.findUnique({ where: { id: data.block_id || 0 }}))?.name ?? null
      const designationName = (await this.prismaService.designations.findUnique({ where: { id:data.designation_id }}))?.name ?? null
      // Step 1: Validate input data
      if (data.actor_id == ActorEnum.TEACHER && !data.udise) {
        throw new BadRequestException(['udise is needed when actor is "Teacher".']);
      }
  
      const latest_assessment_cycle =
        await this.prismaService.assessment_cycles.findFirst({
          select: { id: true },
          orderBy: { end_date: 'desc' },
        });
  
      if (data.actor_id == ActorEnum.EXAMINER && !latest_assessment_cycle) {
        throw new BadRequestException([
          'Assessment cycle is needed when actor is "Examiner".',
        ]);
      }

      
      // Step 2: Interact with FusionAuth service
      const applicationId = this.configService.getOrThrow<string>('FA_APPLICATION_ID');
      const response:any = await this.faService.createAndRegisterUser({
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
      
      // Log FusionAuth response to debug
      this.logger.debug(`FusionAuth status code response for phone_no ${data.phone_no} statusCode: ${response.statusCode}`);

      let allowMentorCreation = false
  
      if (response.statusCode === 400 && response.exception['fieldErrors']['user.username'][0]['code'] === '[inactive]user.username') {
        // Handle inactive user case
  
        // Check if the data.is_active is true or null, and reactivate the user
        if (data.is_active === true || data.is_active === null) {
          this.logger.log(`Reactivating inactive user with phone_no ${data.phone_no} on FusionAuth`);
  
          // Call FusionAuth service to reactivate the user
          const reactivationResponse = await this.faService.reactivateUser(data.phone_no);
  
          // Handle the reactivation response
          if (reactivationResponse.statusCode === 200) {
            this.logger.log(`User with phone_no ${data.phone_no} successfully reactivated on FusionAuth`);
            allowMentorCreation = true
          } else {
            this.logger.error(`Failed to reactivate user with phone_no ${data.phone_no}`, reactivationResponse);
            throw new MentorCreationFailedException('Failed to reactivate user on FusionAuth');
          }
        } else {
          // If user should not be inactivated on FusionAuth, but mentor data need to me updated
          allowMentorCreation = true
        }
      }
  
      if (
        (response.statusCode === 400 && response.exception['fieldErrors']['user.username'][0]['code'] === '[duplicate]user.username') ||
        response.statusCode === 200 || allowMentorCreation
      ) {
        // Step 3: Mentor creation or update
        const mentor = await this.prismaService.mentor.upsert({
          where: { phone_no: data.phone_no },
          create: {
            phone_no: data.phone_no,
            area_type: data.area_type ?? null,
            officer_name: data.officer_name ?? null,
            subject_of_matter: data.subject_of_matter ?? null,
            district_id: data.district_id,
            block_id: data.block_id,
            designation_id: data.designation_id,
            district_name: districtName,
            block_town_name: blockName,
            designation: designationName,
            actor_id: data.actor_id,
            is_active: data.is_active,
          },
          update: {
            area_type: data.area_type ?? null,
            officer_name: data.officer_name ?? null,
            subject_of_matter: data.subject_of_matter ?? null,
            district_id: data.district_id,
            block_id: data.block_id,
            designation_id: data.designation_id,
            district_name: districtName,
            block_town_name: blockName,
            designation: designationName,
            actor_id: data.actor_id,
            is_active: data.is_active,
          },
        });
  
        this.logger.log(`Successfully upserted mentor with phone_no ${data.phone_no}`);
  
        // Step 4: Handle special logic for "Teacher" or "Examiner" roles
        if (data.actor_id == ActorEnum.TEACHER && data.udise) {
          try {
            const school = await this.prismaService.school_list.findFirstOrThrow({
              where: { udise: data.udise },
            });
            this.logger.log(`Found school for UDISE ${data.udise}: ${school.id}`);
  
            // Delete previous mappings and create new one
            await this.prismaService.teacher_school_list_mapping.deleteMany({
              where: { mentor_id: mentor.id },
            });
  
            await this.prismaService.teacher_school_list_mapping.create({
              data: {
                mentor_id: mentor.id,
                school_list_id: school.id,
              },
            });
  
            this.logger.log(`Teacher-school mapping created for mentor: ${mentor.id}, school: ${school.id}`);
          } catch (error) {
            this.logger.error(`Failed to map teacher to school for mentor ${mentor.id}`, error);
            throw error;
          }
        }
  
        if (data.actor_id == ActorEnum.EXAMINER && latest_assessment_cycle) {
          this.logger.log(`Assigning district examiner for assessment cycle: ${latest_assessment_cycle.id}`);
          await this.createAssessmentCycleDistrictExaminerMapping(
            latest_assessment_cycle.id,
            [{ district_id: Number(mentor.district_id), mentor_id: Number(mentor.id) }]
          );
        }
  
        return mentor;
      }
  
      // Log response failure and throw exception with FusionAuth response details
      let description = '';
      if (Number(this.configService.get('DEBUG', 1)) === 1) {
        description = JSON.stringify(response);
      }
      this.logger.error(`Mentor creation failed for phone_no ${data.phone_no}`, { response });
      throw new MentorCreationFailedException('Mentor creation failed!!', description);
  
    } catch (error) {
      // Log detailed error with context
      this.logger.error(`Failed to create mentor with phone no. ${data.phone_no}`, error);
  
      // Error handling specific to database operations or other exceptions
      const { errorMessage, statusCode } = getPrismaErrorStatusAndMessage(error);
  
      // Log error message and status code
      this.logger.error(`Error message: ${errorMessage}, Status Code: ${statusCode}`);
  
      // Throw HTTP exception with specific error details
      throw new HttpException(
        {
          error_message: errorMessage,
          error_code: statusCode,
        },
        statusCode,
      );
    }
  }

  async getMentorByPhone(phone_no: string) {
    const mentor = await this.prismaService.mentor.findUnique({
      where: {
        phone_no: phone_no,
      },
    });
    if (!mentor) {
      throw new NotFoundException(
        `Mentor with phone number ${phone_no} not found`,
      );
    }
    return mentor;
  }

  async createMentorSegment(data: CreateMentorSegmentRequest) {
    const segmentId = data.segment_id
    //Check if a valid segment exists.
    const segment = await this.prismaService.segments.findFirst({
      where: {
        id: segmentId
      }
    });

    //If not a valid segment, throw away.
    if (segment == null) {
      throw new BadRequestException("Segment not found. Please create segment first.")
    }

    //Get all mentors
    const mentors = await this.prismaService.mentor.findMany({
      select: {
        id: true,
        phone_no: true
      },
      where: {
        phone_no: {
          in: data.phone_numbers
        },
      },
    });

    const valid_phones = new Set<String>()

    //Insert mentors into segmentation table
    const result = await this.prismaService.mentor_segmentation.createMany({
      data: mentors.map((mentor) => {
        valid_phones.add(mentor.phone_no)
        return {
          mentor_id: mentor.id,
          segment_id: segmentId
        }
      }),
      skipDuplicates: true,
    });

    const invalid_phones = data.phone_numbers.filter((number) => !valid_phones.has(number))
    return {
      "insertions": result.count,
      valid_phones: Array.from(valid_phones),
      invalid_phones
    }
  }

  async schoolGeofencingBlacklist(data: SchoolGeofencingBlacklistDto) {
    // disable the geo-fencing if the udise list is not empty
    if (data.blacklist.length) {
      await this.prismaService.school_list.updateMany({
        where: {
          udise: {
            in: data.blacklist,
          },
        },
        data: {
          geo_fence_enabled: false,
        },
      });
    }
    if (data.whitelist.length) {
      await this.prismaService.school_list.updateMany({
        where: {
          udise: {
            in: data.whitelist,
          },
        },
        data: {
          geo_fence_enabled: true,
        },
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
    const tables = this.appService.getAssessmentVisitResultsTables(year, month);

    try {
      const relations: Record<string, any> = {
        school_list: {
          include: {
            districts: true,
            blocks: true,
            nyay_panchayats: true,
          },
        },
        subjects: true,
        actors: true,
        blocks: {
          include: {
            districts: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      };
      const studentRelation: Record<string, boolean> = {};
      studentRelation[tables.assessment_visit_results_student_odk_results] = true;
      relations[tables.assessment_visit_results_students] = {
        include: studentRelation,
      };
      // @ts-ignore
      let assessmentVisitResults = await this.prismaService[tables.assessment_visit_results_v2].findMany({
        where: {
          id: {
            gt: rawId,
          },
        },
        orderBy: {
          id: 'asc',
        },
        take: params.limit,
        include: relations,
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
                totalQuestions: studentResult.total_questions,
              },
              odkResultsData: {
                results: studentResult[tables.assessment_visit_results_student_odk_results].map((item: Record<string, any>) => {
                  return {
                    question: item.question,
                    answer: item.answer,
                  };
                }),
                totalMarks: studentResult.achievement,
                totalQuestions: studentResult.total_questions,
              },
              schoolsData: {
                address: 'Address',
                block: assessmentVisitResult.school_list.blocks.name,
                district: assessmentVisitResult.school_list.districts.name,
                nyayPanchayat: assessmentVisitResult.school_list.nyay_panchayats.name,
                schoolName: assessmentVisitResult.school_list.name,
                schoolType: assessmentVisitResult.school_list.type,
                udise: assessmentVisitResult.school_list.udise,
                visitStatus: true,
              },
              studentName: studentResult.student_name,
              subject: assessmentVisitResult.subjects.name,
            },
            viewType: studentResult.module,
          });
        });

        let idIdentifier;
        if (assessmentVisitResult.id < 10000) {
          idIdentifier = BigInt(parseInt(`${yearIdentifier}${monthIdentifier}`) * 10000) + BigInt(assessmentVisitResult.id);
        } else {
          idIdentifier = parseInt(`${yearIdentifier}${monthIdentifier}${assessmentVisitResult.id}`);
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
          created_at: assessmentVisitResult.created_at,
          district: assessmentVisitResult.block_id ? assessmentVisitResult.blocks.districts.name : null,
        });
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
      this.appService.handleRequestError(e);
    }
  }

  async createStudents(students: CreateStudent[]) {
    const studentsData = students.map((student) => {
      return {
        name: student.name,
        gender: student.gender,
        roll_no: student.roll_no,
        unique_id: student.unique_id,
        grade: student.grade,
        udise: student.udise,
        dob: (student?.dob ? new Date(student.dob) : null) ?? null,
        admission_date:
          (student?.admission_date ? new Date(student.admission_date) : null) ??
          null,
        father_name: student.father_name ?? '',
        mother_name: student.mother_name ?? '',
        section: student.section ?? '',
      };
    });
    this.logger.debug(
      `Initiated transaction to create #${studentsData.length} new students `,
    );
    try {
      const response = await this.prismaService.students.createMany({
        // @ts-ignore
        data: studentsData,
        skipDuplicates: true,
      });

    this.logger.debug(`transaction successful to create #${students.length} new students`);
    return response
    } catch (error: any) {
      const { errorMessage } = getPrismaErrorStatusAndMessage(error);
      this.logger.debug(`transaction failed to create #${studentsData.length} new students`, error);

      Sentry.captureMessage(errorMessage, { extra: error });
      throw new InternalServerErrorException(
        errorMessage || 'Failed to create students',
      );
    }
  }

  async updateStudents(
    students: UpdateStudent[],
  ): Promise<StudentsUpdateResponseDto> {
    const failedStudentUpdates: StudentsUpdateResponse[] = [];
    const successStudentUpdates: StudentsUpdateResponse[] = [];

    this.logger.debug(`Initiated transaction for updating #${students.length} students`);


    await Promise.all(
      students.map(async (student: UpdateStudent) => {
        if (student.dob) {
          student.dob = new Date(student.dob);
        }
        if (student.admission_date) {
          student.admission_date = new Date(student.admission_date);
        }
        student.deleted_at = null; // whenever there is an update, we'll restore the student
        try {
          await this.prismaService.students.update({
            where: { unique_id: student.unique_id },
            // @ts-ignore
            data: student,
          });

          successStudentUpdates.push({
            unique_id: student.unique_id,
            message: 'Successfully updated',
          });
        } catch (error: any) {
          const { errorMessage } = getPrismaErrorStatusAndMessage(error);

          Sentry.captureMessage(errorMessage, {
            extra: {
              student_unique_id: student.unique_id,
            },
          });

          failedStudentUpdates.push({
            unique_id: student.unique_id,
            message: errorMessage,
          });
        }
      }),
    );

    this.logger.debug(
      `transaction successful to updated #${successStudentUpdates.length} students out of #${

        successStudentUpdates.length + failedStudentUpdates.length
      }`,
    );

    return {
      message: `Successfully updated ${
        successStudentUpdates.length
      } students out of ${
        successStudentUpdates.length + failedStudentUpdates.length
      }`,
      failedStudentUpdates,
      successStudentUpdates,
    };
  }

  async deleteStudents(students: DeleteStudent[]) {
    try {
      this.logger.debug(
        `Initiated transaction for deleting #${this.deleteStudents.length} students`,
      );

      const response = await this.prismaService.students.updateMany({
        data: {
          deleted_at: new Date(),
        },
        where: {
          unique_id: {
            in: students.map((student) => student.unique_id),
          },
        },
      });

    this.logger.debug(`transaction successful to delete #${students.length} students`);
    return response
    } catch (error: any) {
      const { errorMessage } = getPrismaErrorStatusAndMessage(error);
      this.logger.debug('transaction failed to delete students', error);
      Sentry.captureMessage(errorMessage, { extra: error });

      throw new InternalServerErrorException(
        errorMessage || 'Failed to delete students',
      );
    }
  }

  async createAssessmentCycle(cycleData: CreateAssessmentCycle) {
    const startDate = new Date(cycleData.start_date);
    const endDate = new Date(cycleData.end_date);
    if (endDate < startDate) {
      throw new UnprocessableEntityException('Start Date must be less than End Date.');
    } else if (await this.prismaService.assessment_cycles.count({
      where: {
        start_date: {
          lte: endDate,
        },
        end_date: {
          gte: startDate,
        },
      },
    })) {
      throw new UnprocessableEntityException('There already exists a date range falling between the current start/end dates.');
    }
    return this.prismaService.assessment_cycles.create({
      data: {
        name: cycleData.name,
        start_date: new Date(cycleData.start_date),
        end_date: new Date(cycleData.end_date),
        class_1_students_count: cycleData.class_1_students_count,
        class_1_nipun_percentage: cycleData.nipun_percentage,
        class_2_students_count: cycleData.class_2_students_count,
        class_2_nipun_percentage: cycleData.nipun_percentage,
        class_3_students_count: cycleData.class_3_students_count,
        class_3_nipun_percentage: cycleData.nipun_percentage,
      },
    });
  }

  async createAssessmentCycleDistrictSchoolMapping(cycleId: number, data: Array<CreateAssessmentCycleDistrictSchoolMapping>) {
    const cycle: Record<string, number> = await this.prismaService.assessment_cycles.findUniqueOrThrow({
      where: {
        id: cycleId,
      },
      select: {
        class_1_students_count: true,
        class_2_students_count: true,
        class_3_students_count: true,
      },
    });
    const schoolWiseRandomStudents = await this.getRandomStudentsForUdise(cycle, data.map(item => item.udise));

    const records: Array<{
      cycle_id: number,
      udise: number,
      class_1_students: Array<string>,
      class_2_students: Array<string>,
      class_3_students: Array<string>
    }> = [];
    data.forEach(item => {
      const grade1Students = schoolWiseRandomStudents[item.udise]['grade1'];
      const grade2Students = schoolWiseRandomStudents[item.udise]['grade2'];
      const grade3Students = schoolWiseRandomStudents[item.udise]['grade3'];
      records.push({
        cycle_id: cycleId,
        udise: item.udise,
        // DB can also return [null], check for that as well
        class_1_students: (grade1Students && grade1Students[0] !== null) ? grade1Students : [],
        class_2_students: (grade2Students && grade2Students[0] !== null) ? grade2Students : [],
        class_3_students: (grade3Students && grade3Students[0] !== null) ? grade3Students : [],
      });
    });
    return this.prismaService.assessment_cycle_district_school_mapping.createMany({
      // @ts-ignore
      data: records,
      skipDuplicates: true,
    });
  }

  private async getRandomStudentsForUdise(cycle: Record<string, number>, udises: Array<number>) {
    let response: Record<number, { grade1: Array<string>, grade2: Array<string>, grade3: Array<string> }> = {};
    const grade1Count = cycle.class_1_students_count || 0;
    const grade2Count = cycle.class_2_students_count || 0;
    const grade3Count = cycle.class_3_students_count || 0;

    udises.forEach(udise => {
      // populate response with all udises with grade keys
      response[udise] = {
        grade1: [],
        grade2: [],
        grade3: [],
      };
    });

    const query = `
      SELECT udise, grade, json_agg(unique_id) AS random_unique_ids
      FROM (
          SELECT s.udise, s.grade, s.unique_id,
                ROW_NUMBER() OVER (PARTITION BY s.udise, s.grade ORDER BY random()) AS rn
          FROM students s
          WHERE s.udise = ANY($1)
            AND s.grade IN (1, 2, 3)
            AND s.deleted_at IS NULL
            AND NOT EXISTS (
                SELECT 1
                FROM cwsn_students cs
                WHERE cs.student_id = s.unique_id
                  AND cs.is_active = true
            )
      ) AS ranked
      WHERE rn <= (${Math.max(grade1Count, grade2Count, grade3Count)}) 
      GROUP BY udise, grade;
    `

    const records: Array<Record<string, any>> = await this.prismaService.$queryRawUnsafe(query, udises);
    records.forEach(record => {
      switch (record.grade) {
        case 1:
          response[record.udise]['grade1'] = record.random_unique_ids.slice(0, Math.min(record.random_unique_ids.length, grade1Count));
          break;
        case 2:
          response[record.udise]['grade2'] = record.random_unique_ids.slice(0, Math.min(record.random_unique_ids.length, grade2Count));
          break;
        case 3:
          response[record.udise]['grade3'] = record.random_unique_ids.slice(0, Math.min(record.random_unique_ids.length, grade3Count));
          break;
      }
    });
    return response;
  }

  async createAssessmentCycleDistrictExaminerMapping(cycleId: number, data: Array<CreateAssessmentCycleDistrictExaminerMapping>) {
    const records: Array<{
      cycle_id: number,
      district_id: number,
      mentor_id: number,
    }> = [];
    data.forEach(item => {
      records.push({
        cycle_id: cycleId,
        district_id: item.district_id,
        mentor_id: item.mentor_id,
      });
    });
    return this.prismaService.assessment_cycle_district_mentor_mapping.createMany({
      data: records,
      skipDuplicates: true,
    });
  }

  async clearAllMentorCache(mentorId: bigint) {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear() 

    const keys = [
      CacheKeyMentorMonthlyVisitedSchools(mentorId, currentMonth, currentYear),
      CacheKeyMentorWeeklyMetrics(mentorId, currentMonth, currentYear),
      CacheKeyMentorMonthlyMetrics(mentorId, currentMonth, currentYear)
    ]
    // remove metadata for all actors and all app-versions
    keys.push(...await this.getCacheKeysByPattern(CacheKeyMetadataAll()))

    const promises = keys.map(key => this.cacheService.del(key))
    return Promise.all(promises)
  }
  async invalidateAssessmentCycleExaminerAssessments(cycleId: number, data: InvalidateExaminerCycleAssessmentsDto) {
    const cycle = await this.prismaService.assessment_cycles.findUniqueOrThrow({
      where: {
        id: cycleId,
      },
    });

    // Get assessment cycles for the current quarter which should be mapped to the latest cycle in progress
    const promises = [];

    // soft delete assessments
    promises.push(this.prismaService.assessments.updateMany({
      where: {
        udise: {
          in: data.udises,
        },
        mentor_id: data.mentor_id,
        actor_id: ActorEnum.EXAMINER,
        created_at: {
          gte: new Date(cycle.start_date),
          lte: new Date(cycle.end_date),
        },
        NOT: {
          student_id: null,
        },
      },
      data: {
        is_valid: false,
        updated_at: new Date(),
      }
    }))

    // soft delete on quarter table
    // We only delete assessment_visit_results_v2 as other quarter tables are connected via FKs
    const quarterAssessmentTables = this.appService.getAssessmentVisitResultsTables()
    // @ts-ignore
    promises.push(this.prismaService[quarterAssessmentTables.assessment_visit_results_v2].updateMany({
      where: {
        udise: {
          in: data.udises,
        },
        mentor_id: data.mentor_id,
        created_at: {
          gte: new Date(cycle.start_date),
          lte: new Date(cycle.end_date),
        }
      },
      data: {
        is_valid: false,
        updated_at: new Date(),
      }
    }));
    
    // delete school nipun results
    promises.push(this.prismaService.assessment_cycle_school_nipun_results.deleteMany({
      where: {
        udise: {
          in: data.udises,
        },
        mentor_id: data.mentor_id,
        cycle_id: cycleId,
      },
    }))

    // club 2 promises together so they run in sequence
    const resetSchoolNipunResults = async () => {
      // delete student mappings to school
      let res = [await this.prismaService.assessment_cycle_district_school_mapping.deleteMany({
        where: {
          cycle_id: cycle.id,
          udise: {
            in: data.udises,
          },
        },
      })]

      if(data.reset_all) {
        // reset assessment_cycle_school_nipun_results to recreate new student mappings
        const assessmentCycledistrictSchoolMappings = data.udises.map(udise => { return {udise: udise} as CreateAssessmentCycleDistrictSchoolMapping})
        //@ts-ignore
        res.push(await this.createAssessmentCycleDistrictSchoolMapping(cycle.id, assessmentCycledistrictSchoolMappings))
      }
      return res;
    }

    promises.push(resetSchoolNipunResults());
    
    if (data.delete_all) {
      // delete cycle mentor mapping
      promises.push(this.prismaService.assessment_cycle_district_mentor_mapping.deleteMany({
        where: {
          mentor_id: data.mentor_id,
          cycle_id: cycleId,
        },
      }));
    }
    promises.push(this.clearAllMentorCache(BigInt(data.mentor_id)))
    return Promise.all(promises)
  }

  async getCacheKeysByPattern(pattern: string): Promise<string[]> {
    const allKeys = await this.cacheService.store.keys(pattern);
    return allKeys;
  }
  

  async clearMentorCache(phoneNumbers: string[]) {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    const mentorCachePromises = phoneNumbers.map((phoneNumber) => {
      const schoolListKey = CacheKeyMentorSchoolList(phoneNumber, month, year);
      const metricsV2Key = CacheKeyMentorMonthlyMetricsV2(phoneNumber, month, year);
      
      return Promise.all([
          this.cacheService.del(schoolListKey),
          this.cacheService.del(metricsV2Key)
      ]);
  });

    const metadataKeys: string[] = [];
      // remove metadata for all actors and all app-versions
    metadataKeys.push(...await this.getCacheKeysByPattern(CacheKeyMetadataAll()));
    const metadataPromises = metadataKeys.map((key)=>{
    return this.cacheService.del(key)
  });

    try {
      // remove mentor details and other cache
      await Promise.all([
        this.clearMentorDetailCache(phoneNumbers),
        ...metadataPromises,
        ...mentorCachePromises
      ]);
    } catch (e) {
      this.logger.error(e);
      return { status: 'Cache Clearing Failed', error: e }
    }
    return { status: 'Cache Cleared Successfully' };
  }  

  async clearMentorDetailCache(phoneNo: string[]) {
    const mentorDetailPromises = phoneNo.map((phoneNumber) => {
      return this.cacheService.del(CacheKeyMentorDetail(phoneNumber));
    });
    return await Promise.all(mentorDetailPromises);
  }

  async createActorSchoolBlacklist(body: CreateUpdateSchoolBlacklistDto[]) {
    const response = await this.prismaService.actor_school_blacklist.createMany(
      {
        data: body,
        skipDuplicates: true,
      },
    );
    // Clear teacher mentor-detail cache for all mentors of given actor after actor-school blacklist creation
    //@ts-ignore
    const teacherPhoneNo: string[] = await Promise.all(
      body.map((data) =>
        this.appService.getTeacherPhoneByActorIdAndUdise(
          data.actor_id,
          data.udise,
        ),
      ),
    );

    // Filter out falsy values from the results
    const actorPhoneNumbers = teacherPhoneNo.filter(Boolean);

    // Clear cache using the filtered phone numbers
    await this.clearMentorDetailCache(actorPhoneNumbers);

    // Return create response
    return response;
  }

  async updateActorSchoolBlacklist(body: CreateUpdateSchoolBlacklistDto[]) {
    const updatePromises = body.map((data) => {
      return this.prismaService.actor_school_blacklist.update({
        where: {
          actor_id_udise: {
            actor_id: data.actor_id,
            udise: data.udise,
          },
        },
        data: {
          is_active: data.is_active ?? false,
        },
      });
    });
    const response = await Promise.all(updatePromises);
    // Clear teacher mentor-detail cache for all mentors of given actor after actor-school blacklist updating
    //@ts-ignore
    const teacherPhoneNo: string[] = await Promise.all(
      body.map((data) =>
        this.appService.getTeacherPhoneByActorIdAndUdise(
          data.actor_id,
          data.udise,
        ),
      ),
    );

    // Filter out falsy values from the results
    const actorPhoneNumbers = teacherPhoneNo.filter(Boolean);

    // Clear cache using the filtered phone numbers
    await this.clearMentorDetailCache(actorPhoneNumbers);

    // return update response
    return response;
  }

  async getActorSchoolBlacklist() {
    return await this.prismaService.actor_school_blacklist.findMany();
  }

  async deleteActorSchoolBlacklist(body: CreateUpdateSchoolBlacklistDto[]) {
    const operations = body.map((data) => {
      return this.prismaService.actor_school_blacklist.update({
        where: {
          actor_id_udise: {
            actor_id: data.actor_id,
            udise: data.udise,
          },
        },
        data: {
          is_active: false,
        },
      });
    });
    const response = await Promise.all(operations);
    // Clear teacher mentor-detail cache for all mentors of given actor after actor-school blacklist deleting
    //@ts-ignore
    const teacherPhoneNo: string[] = await Promise.all(
      body.map((data) =>
        this.appService.getTeacherPhoneByActorIdAndUdise(
          data.actor_id,
          data.udise,
        ),
      ),
    );

    // Filter out falsy values from the results
    const actorPhoneNumbers = teacherPhoneNo.filter(Boolean);

    // Clear cache using the filtered phone numbers
    await this.clearMentorDetailCache(actorPhoneNumbers);

    // return delete response
    return response;
  }

  async createCompetencies(body:CreateCompetencyDto[]){
    return await this.prismaService.competency_mapping.createMany({
      data:body
    })
  }

  async getAllSchoolUdises() {
    return await this.prismaService.school_list.findMany({
      select: {
        udise: true,
      },
    });
  }

  async createUpdateCwsnStudents(body: CreateUpdateCwsnStudents[]) {
    return await this.prismaService.cwsn_students.createMany({
      data: body,
    });
  }

  async invalidateStudentAssessment(payload: InvalidateStudentAssessmentDto) {
    const { cycle_id, mentor_phone, student_id } = payload;
    
    // Fetch the assessment cycle
    const cycle = await this.prismaService.assessment_cycles.findUnique({
      where: { id: cycle_id }
    });
    if (!cycle) {
      throw new BadRequestException(`Assessment cycle with ID ${cycle_id} not found.`);
    }

    // Convert DateTime to BigInt timestamps for comparison
    const cycleStartTimestamp = BigInt(cycle.start_date.getTime());
    const cycleEndTimestamp = BigInt(cycle.end_date.getTime());

    // Fetch the mentor
    const mentor = await this.prismaService.mentor.findUnique({
      where: { phone_no: mentor_phone }
    });
    if (!mentor) {
      throw new BadRequestException(`Mentor with phone number ${mentor_phone} not found.`);
    }

    if (mentor.actor_id !== ActorEnum.EXAMINER) {
      throw new BadRequestException(`Mentor with phone number ${mentor_phone} is not an examiner.`);
    }

    // Update assessments within the cycle period
    const response = await this.prismaService.assessments.updateMany({
      where: {
        mentor_id: mentor.id,
        student_id: student_id,
        submission_timestamp: {
          gte: cycleStartTimestamp,
          lte: cycleEndTimestamp
        }
      },
      data: {
        is_valid: false
      }
    });

    if (response.count === 0) {
      throw new NotFoundException(`No assessments found for student ID ${student_id} by mentor ID ${mentor.id} within the cycle period.`);
    }

    return response;
  }


}
