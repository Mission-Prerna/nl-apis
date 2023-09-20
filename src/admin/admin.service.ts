import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import { FusionauthService } from '../fusionauth.service';
import { CreateMentorDto } from '../dto/CreateMentor.dto';
import { ActorEnum } from '../enums';
import { MentorCreationFailedException } from '../exceptions/mentor-creation-failed.exception';
import { CreateMentorOldDto } from '../dto/CreateMentorOld.dto';
import { SchoolGeofencingBlacklistDto } from '../dto/SchoolGeofencingBlacklistDto';
import { GetAssessmentVisitResultsDto } from '../dto/GetAssessmentVisitResults.dto';
import { AppService } from '../app.service';

@Injectable()
export class AdminService {
  protected readonly logger = new Logger(AdminService.name);

  constructor(
    protected readonly prismaService: PrismaService,
    protected readonly configService: ConfigService,
    protected readonly faService: FusionauthService,
    protected readonly appService: AppService,
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
    };
    return this.createMentor(newDto);
  }

  async createMentor(data: CreateMentorDto) {
    if (data.actor_id == ActorEnum.TEACHER && !data.udise) {
      throw new BadRequestException(['udise is needed when actor is "Teacher".']);
    }
    /*
      It's a 2-step process:
      1. Create a user on Fusion auth if not already exists.
      2. Create mentor at backend.
     */
    const applicationId = this.configService.getOrThrow<string>('FA_APPLICATION_ID');
    const response = await this.faService.createAndRegisterUser({
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
    if (
      (
        // @ts-ignore
        response.statusCode == 400 && response.exception['fieldErrors']['user.username'][0]['code'] == '[duplicate]user.username'
      ) || response.statusCode == 200
    ) {
      // if success or duplicate username error, we consider it as success
      const mentor = await this.prismaService.mentor.upsert({
        where: {
          phone_no: data.phone_no,
        },
        create: {
          phone_no: data.phone_no,
          area_type: data.area_type ?? null,
          officer_name: data.officer_name ?? null,
          subject_of_matter: data.subject_of_matter ?? null,
          district_id: data.district_id,
          block_id: data.block_id,
          designation_id: data.designation_id,
          actor_id: data.actor_id,
        },
        update: {
          area_type: data.area_type ?? null,
          officer_name: data.officer_name ?? null,
          subject_of_matter: data.subject_of_matter ?? null,
          district_id: data.district_id,
          block_id: data.block_id,
          designation_id: data.designation_id,
          actor_id: data.actor_id,
        },
      });

      if (data.actor_id == ActorEnum.TEACHER && data.udise) {
        const school = await this.prismaService.school_list.findFirstOrThrow({
          where: {
            udise: data.udise,
          },
        });

        // delete all previous entries for mentor
        await this.prismaService.teacher_school_list_mapping.deleteMany({
          where: {
            mentor_id: mentor.id,
          },
        });

        // create new teacher school mapping
        await this.prismaService.teacher_school_list_mapping.create({
          data: {
            mentor_id: mentor.id,
            school_list_id: school.id,
          },
        });
      }

      return mentor;
    }
    let description = '';
    if (Number(this.configService.get('DEBUG', 1)) === 1) {
      description = JSON.stringify(response);
    }
    throw new MentorCreationFailedException('Mentor creation failed!!', description);
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
}