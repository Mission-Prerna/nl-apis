import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, UnprocessableEntityException, forwardRef } from '@nestjs/common';
import * as Sentry from '@sentry/minimal';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { AppService } from '../app.service';
import { GetSchoolStatusDto } from '../dto/GetSchoolStatus.dto';
import { GetSchoolStudentsResultDto } from '../dto/GetSchoolStudentsResult.dto';
import {
  ActorEnum,
  AssessmentTypeEnum,
  Mentor,
  SchoolCycleAssessmentStatus,
  Student,
  StudentMonthlyAssessmentStatus,
  TypeTeacherHomeOverview,
} from '../enums';
import { PrismaService } from '../prisma.service';
import { SchoolService } from './school.service';
import { StudentService } from './student.service';
import { CreateSchoolListDto, SchoolListExcelDataDto } from './dto/CreateSchoolList.dto';
import { getPrismaErrorStatusAndMessage } from 'src/utils/utils';
import * as XLSX from 'xlsx';
import { CreateSchoolListResponseDto, SchoolListResponse } from './dto/CreateSchoolListResponse.dto';
const moment = require('moment');

@Injectable()
export class SchoolServiceV2 extends SchoolService {
  protected readonly logger = new Logger(SchoolServiceV2.name);

  constructor(
    protected readonly prismaService: PrismaService,
    // Circular dependency to App Service
    @Inject(forwardRef(() => AppService))
    protected readonly appService: AppService,
    protected readonly i18n: I18nService,
    protected readonly studentService: StudentService,
  ) {
    super(prismaService, appService, i18n);
  }

  async getSchoolStudentsResultsV2(mentor: Mentor, udise: number, params: GetSchoolStudentsResultDto) {
    // @TODO: to be redone using Continuous Aggregates
    const year = params.year;
    const month = params.month;
    const grades = params.grade.split(',').map(grade => parseInt(grade.trim()));
    const cycleId = params.cycle_id;
    let firstDayTimestamp = '';
    let lastDayTimestamp = '';
    let studentsList: Array<Student> = [];
    switch (mentor.actor_id) {
      case ActorEnum.TEACHER:
      case ActorEnum.MENTOR:
      case ActorEnum.DIET_MENTOR:
        // for teacher, mentor & diet mentor
        if (!month || !year) {
          throw new UnprocessableEntityException('Missing [month,year] params.');
        }
        firstDayTimestamp = moment().month(month - 1).year(year).date(1).startOf('day');  // first day of current month
        lastDayTimestamp = moment(firstDayTimestamp).add(1, 'months'); // 1st day of next month
        studentsList = await this.studentService.getSchoolStudents(udise);
        break;
      case ActorEnum.EXAMINER:
        // for examiner
        if (!cycleId) {
          throw new UnprocessableEntityException('Missing [cycle_id] param.');
        }
        const cycle = await this.prismaService.assessment_cycles.findUniqueOrThrow({
          where: { id: cycleId },
        });
        firstDayTimestamp = moment(cycle.start_date);
        lastDayTimestamp = moment(cycle.end_date);
        studentsList = await this.studentService.getCycleStudents(udise, cycleId, grades);
        break;
      default:
        Sentry.captureMessage('Un-supported Actor found.', {
          user: {
            id: mentor.id + '',
          },
          extra: {
            actor_id: mentor.actor_id,
            udise: udise,
            cycle_id: cycleId,
            year: year,
            month: month,
          },
        });
        throw new ForbiddenException('You are not allowed to perform this action.');
    }

    const query = `
      SELECT ss.id,
        ss.last_assessment_date,
        (case when ss.failed = 0 then true else false end) as is_passed
      FROM (
        SELECT a.student_id                                                         AS id,
              a.submitted_at                                                       AS last_assessment_date,
              COUNT(CASE WHEN a.is_passed = false THEN 1 END)                      AS failed,
              RANK() OVER (PARTITION BY a.student_id ORDER BY a.submitted_at DESC) AS rank
        FROM assessments a
        WHERE a.student_id IS NOT NULL
         AND a.udise = $1
         AND a.is_valid = true
         AND a.actor_id = $2
         AND a.student_id not in ('-1', '-2', '-3') --// we don't want anonymous students
         AND a.submission_timestamp BETWEEN $4 AND $5
         and a.grade = ANY($3::smallint[])
        GROUP BY a.student_id, a.submitted_at
      ) ss
      WHERE rank = 1`;
    const studentWiseResults: Record<string, Student> = {};
    const result: Array<Student> = await this.prismaService.$queryRawUnsafe(query, udise, mentor.actor_id, grades, firstDayTimestamp.valueOf(), lastDayTimestamp.valueOf());
    result.forEach((res) => {
      // iterate and create a map student id wise for later faster fetching
      studentWiseResults[res.id.toString()] = res;
    });

    // Grade summary
    const gradeStudents: Record<string, { students: Array<Student>, nipun: number, not_nipun: number }> = {};
    studentsList.forEach(({ grade, id }: Student) => {
      grade = grade ?? 0; // just a ts check
      const assessedStudent = studentWiseResults[id.toString()] ?? null;
      if (!gradeStudents.hasOwnProperty(grade)) {
        gradeStudents[grade] = {
          students: [],
          nipun: 0,
          not_nipun: 0,
        };
      }
      if (assessedStudent) {
        assessedStudent.is_passed ? gradeStudents[grade].nipun++ : gradeStudents[grade].not_nipun++;
        gradeStudents[grade].students.push({
          id: id,
          status: assessedStudent.is_passed ? StudentMonthlyAssessmentStatus.PASS : StudentMonthlyAssessmentStatus.FAIL,
          last_assessment_date: moment(assessedStudent.last_assessment_date).unix() * 1000,
        });
      } else {
        gradeStudents[grade].students.push({
          id: id,
          status: StudentMonthlyAssessmentStatus.PENDING,
          last_assessment_date: null,
        });
      }
    });

    let response: Array<Record<string, any>> = [];
    const lang: string = I18nContext?.current()?.lang ?? 'en';
    for (const grade of grades) {
      response.push({
        grade: this.i18n.t(`grades.${grade}`, { lang: lang }),
        period: month ? this.i18n.t(`months.${moment(month, 'M').format('MMMM')}Month`, { lang: lang }) : '',
        summary: [
          {
            label: this.i18n.t(`common.Nipun`, { lang: lang }),
            colour: '#72BA86',
            count: gradeStudents[grade.toString()]?.nipun ?? 0,
            identifier: StudentMonthlyAssessmentStatus.PASS,
          },
          {
            label: this.i18n.t(`common.NotNipun`, { lang: lang }),
            colour: '#C98A7A',
            count: gradeStudents[grade.toString()]?.not_nipun ?? 0,
            identifier: StudentMonthlyAssessmentStatus.FAIL,
          },
          {
            label: this.i18n.t(`common.NotAssessed`, { lang: lang }),
            colour: '#E2E2E2',
            count: (gradeStudents[grade.toString()]?.students.length - gradeStudents[grade.toString()]?.nipun ?? 0 - gradeStudents[grade.toString()]?.not_nipun ?? 0),
            identifier: StudentMonthlyAssessmentStatus.PENDING,
          },
        ],
        students: gradeStudents[grade.toString()]?.students,
      });
    }

    return response;
  }

  async getSchoolStudentsResultsSummary(mentor: Mentor, udise: number, grades: Array<Number>, xMonths: number = 12) {
    // @TODO: to be redone using Continuous Aggregates
    // find out all the months for which we wanted to fetch summary data for
    const globalStartDate = moment('2023-09-01');  // the date post which this feature was made live
    let startDate = moment(globalStartDate).subtract(xMonths, 'months').startOf('month');
    const now = moment();
    const monthsForQuery: Array<{ year: number, month: number }> = [];
    while (startDate < now) {
      if (startDate >= globalStartDate) {
        // this is the month we shall consider
        monthsForQuery.push({ year: startDate.year(), month: startDate.month() });
      }
      if (startDate > now) {
        break;
      }
      startDate = startDate.add('1', 'month');
    }

    const gradeWiseSummary: Record<string, any> = {};
    let summaries: Record<string, object> = {};
    const lang: string = I18nContext?.current()?.lang ?? 'en';
    monthsForQuery.forEach(item => {
      const monthName = moment().month(item.month).year(item.year).date(1).format('MMMM');
      summaries[monthName] = {
        year: item.year,
        month: item.month + 1,  // as item.month is index of the month
        period: this.i18n.t(`months.${monthName}`, { lang: lang }),
        total: 0,
        assessed: 0,
        successful: 0,
        updated_at: 0,
      };
    });

    const gradesTotal = await this.studentService.getGradeStudentsCount(udise);
    for (let grade of grades) {
      let summary = JSON.parse(JSON.stringify(summaries)); // we needed deep copy of `summaries` object
      const gradeTotal = gradesTotal.filter((item) => {
        return item.grade == grade;
      });

      // set total for each summary object
      Object.entries(summary).forEach(key => {
        summary[key[0]].total = gradeTotal[0]?.count ?? 0;
      });
      gradeWiseSummary[grade.toString()] = {
        grade: this.i18n.t(`grades.${grade}`, { lang: lang }),
        summary: summary,
      };
    }
    for (const item of monthsForQuery) {
      const startTime = moment().month(item.month).year(item.year).date(1).startOf('day')
      const endTime = moment(startTime).add(1, 'months')

      const query = `
      select t.grade,
        count(t.student_id)                                        as assessed,
        count(case when t.is_passed is true then t.student_id end) as nipun,
        max(t.submission_timestamp)                                as updated_at
      from (
        select distinct on (a.student_id) student_id,
                                         a.grade,
                                         a.submitted_at,
                                         a.submission_timestamp,
                                         a.is_passed
        from assessments a
        where a.student_id is not null
          and a.udise = $1
          and a.actor_id = ${ActorEnum.TEACHER}
          and a.student_id not in ('-1', '-2', '-3') --// we don't want anonymous students
          and a.submitted_at between '${startTime.format('YYYY-MM-DD HH:mm:ss')}' and '${endTime.format('YYYY-MM-DD HH:mm:ss')}'
          and a.grade = ANY($2::smallint[])
          and a.is_valid = true
        order by a.student_id, a.submitted_at DESC
      ) t
      group by grade`;
      
      const result: Array<Record<string, number>> = await this.prismaService.$queryRawUnsafe(
        query, 
        udise, 
        grades
      );
      for (const row of result) {
        gradeWiseSummary[row.grade.toString()].summary[moment().month(item.month).year(item.year).date(1).format('MMMM')].assessed = row.assessed;
        gradeWiseSummary[row.grade.toString()].summary[moment().month(item.month).year(item.year).date(1).format('MMMM')].successful = row.nipun;
        gradeWiseSummary[row.grade.toString()].summary[moment().month(item.month).year(item.year).date(1).format('MMMM')].updated_at = row.updated_at;
      }
    }

    let response = Object.values(gradeWiseSummary); // remove grade keys from `gradeWiseSummary` object
    for (let item of response) {
      item.summary = Object.values(item.summary); // remove month name keys from summary objects
    }
    return response;
  }

  async getTeacherStudentsSummaryResultForPeriodV2(
    mentor: Mentor,
    udise: number,
    firstDayTimestamp: number,
    lastDayTimestamp: number): Promise<TypeTeacherHomeOverview | null> {
    try {
      const query = `
        select count(distinct student_id)                                               as assessments_total,
          count(distinct case when is_passed = true then student_id end)           as nipun_total,
          max(submitted_at)                                                        as updated_at,
          string_agg(distinct student_id, ',')                                     as assessed_student_ids,
          string_agg(distinct case when is_passed = true then student_id end, ',') as nipun_student_ids
        from (
          select distinct on (student_id) a.student_id,
                                         a.submitted_at,
                                         a.is_passed
          from assessments a
          where a.mentor_id = $1
            and a.is_valid = true
            and a.actor_id = ${ActorEnum.TEACHER}
            and a.udise = $2
            and a.assessment_type_id = ${AssessmentTypeEnum.NIPUN_ABHYAS}
            and a.student_id is not null
            and a.student_id not in ('-1', '-2', '-3') --// we don't want anonymous students
            and a.submission_timestamp between $3 and $4
          order by student_id, submitted_at DESC
        ) t`;
        const result: Array<TypeTeacherHomeOverview> = await this.prismaService.$queryRawUnsafe(query, mentor.id, udise, firstDayTimestamp, lastDayTimestamp);
        return {
        assessments_total: result[0].assessments_total,
        nipun_total: result[0].nipun_total,
        updated_at: result[0].updated_at ? (moment(result[0].updated_at).unix() * 1000) : 0,
        assessed_student_ids: result[0].assessed_student_ids,
        nipun_student_ids: result[0].nipun_student_ids,
      };
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.appService.handleRequestError(e);
    }
    return null;
  }

  async getSchoolTeacherPerformance(mentor: Mentor, udise: number) {
    // @TODO: to be redone using Continuous Aggregates
    const lastDate = new Date();  // it's now() basically
    const temp = new Date();
    const day = lastDate.getDay(), diff = lastDate.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    const firstDate = new Date(temp.setDate(diff));

    const firstDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0);
    const lastDayTimestamp = lastDate.getTime();

    let responseFirstTable: TypeTeacherHomeOverview | null = await this.getTeacherStudentsSummaryResultForPeriodV2(
      mentor,
      udise,
      firstDayTimestamp,
      lastDayTimestamp,
    );

    const weekly = {
      assessments_total: (responseFirstTable?.assessments_total || 0),
      nipun_total: (responseFirstTable?.nipun_total || 0),
      updated_at: (responseFirstTable?.updated_at || 0),
      assessed_student_ids: (responseFirstTable?.assessed_student_ids || ''),
      nipun_student_ids: (responseFirstTable?.nipun_student_ids || ''),
    };

    const currentMonthName = moment().utc().format('MMMM');
    const currentMonth = moment().utc().month() + 1;
    const currentYear = moment().utc().year();
    const currentMonthStartTimestamp = moment().utc().startOf('month').unix() * 1000; // in milliseconds
    const currentMonthEndTimestamp = moment().utc().unix() * 1000;  // in milliseconds
    const currentMonthStats = await this.getTeacherStudentsSummaryResultForPeriodV2(
      mentor,
      udise,
      currentMonthStartTimestamp,
      currentMonthEndTimestamp,
    );

    const lastMonthName = moment().utc().subtract(1, 'month').format('MMMM');
    const lastMonth = (currentMonth == 1) ? 12 : (currentMonth - 1);
    const lastYear = (currentMonth == 1) ? (currentYear - 1) : currentYear;
    const lastMonthStartTimestamp = moment().utc().subtract(1, 'month').startOf('month').unix() * 1000; // in milliseconds
    const lastMonthEndTimestamp = moment().utc().subtract(1, 'month').endOf('month').unix() * 1000; // in milliseconds
    const lastMonthStats = await this.getTeacherStudentsSummaryResultForPeriodV2(
      mentor,
      udise,
      lastMonthStartTimestamp,
      lastMonthEndTimestamp,
    );
    const lang: string = I18nContext?.current()?.lang ?? 'en';
    return [
      {
        type: 'week',
        year: currentYear,
        month: currentMonth,
        period: this.i18n.t(`common.Weekly`, { lang: lang }),
        insights: [
          {
            label: this.i18n.t(`common.AssessedStudents`, { lang: lang }),
            count: weekly?.assessments_total ?? 0,
            identifier: 'assessed',
            student_ids: weekly?.assessed_student_ids?.split(',') ?? [],
          },
          {
            label: this.i18n.t(`common.NipunStudents`, { lang: lang }),
            count: weekly?.nipun_total ?? 0,
            identifier: 'pass',
            student_ids: weekly?.nipun_student_ids?.split(',') ?? [],
          },
        ],
        updated_at: weekly?.updated_at ?? 0,
      },
      {
        type: 'month',
        year: currentYear,
        month: currentMonth,
        period: this.i18n.t(`months.${currentMonthName}Month`, { lang: lang }),
        insights: [
          {
            label: this.i18n.t(`common.AssessedStudents`, { lang: lang }),
            count: currentMonthStats?.assessments_total ?? 0,
            identifier: 'assessed',
            student_ids: currentMonthStats?.assessed_student_ids?.split(',') ?? [],
          },
          {
            label: this.i18n.t(`common.NipunStudents`, { lang: lang }),
            count: currentMonthStats?.nipun_total ?? 0,
            identifier: 'pass',
            student_ids: currentMonthStats?.nipun_student_ids?.split(',') ?? [],
          },
        ],
        updated_at: currentMonthStats?.updated_at ?? 0,
      },
      {
        type: 'month',
        year: lastYear,
        month: lastMonth,
        period: this.i18n.t(`months.${lastMonthName}Month`, { lang: lang }),
        insights: [
          {
            label: this.i18n.t(`common.AssessedStudents`, { lang: lang }),
            count: lastMonthStats?.assessments_total ?? 0,
            identifier: 'assessed',
            student_ids: lastMonthStats?.assessed_student_ids?.split(',') ?? [],
          },
          {
            label: this.i18n.t(`common.NipunStudents`, { lang: lang }),
            count: lastMonthStats?.nipun_total ?? 0,
            identifier: 'pass',
            student_ids: lastMonthStats?.nipun_student_ids?.split(',') ?? [],
          },
        ],
        updated_at: lastMonthStats?.updated_at ?? 0,
      },
    ];
  }

  async getSchoolStatus(mentor: Mentor, params: GetSchoolStatusDto) {
    if (params.cycle_id) {
      // it's for assessment cycle drives & we'll process accordingly
      const query = `
        select dsm.udise,
           (case
                when snr.is_nipun = true then '${SchoolCycleAssessmentStatus.PASS}'
                when snr.is_nipun = false then '${SchoolCycleAssessmentStatus.FAIL}'
                else '${SchoolCycleAssessmentStatus.PENDING}' end) as status,
           (EXTRACT(EPOCH FROM case when snr.updated_at is not null then snr.updated_at else '1970-01-01 00:00:00+00:00' end) * 1000)::bigint as updated_at
        from assessment_cycle_district_school_mapping dsm
                 left join assessment_cycle_school_nipun_results snr
                           on dsm.udise = snr.udise and snr.mentor_id = $1 and snr.cycle_id = $2
                  left join school_list sl on dsm.udise = sl.udise
        where dsm.cycle_id = $2
          and sl.district_id in (select district_id
                              from assessment_cycle_district_mentor_mapping
                              where mentor_id = $1
                                and cycle_id = $2)
      `;
      return this.prismaService.$queryRawUnsafe(query, mentor.id, params.cycle_id);
    }
    return null;
  }

  async calculateExaminerCycleUdiseResult(mentorID: number, cycleId: number, udise: number) {
    // find out cycle details, students list & nipun percentage for the udise
    const cycleDetails: Array<Record<string, number | string | Array<string>>> = await this.prismaService.$queryRawUnsafe(`
      select 
        c.id,
        c.start_date,
        c.end_date,
        c.class_1_nipun_percentage,
        c.class_2_nipun_percentage,
        c.class_3_nipun_percentage,
        json_agg(dsm.class_1_students) as class_1_students,
        json_agg(dsm.class_2_students) as class_2_students,
        json_agg(dsm.class_3_students) as class_3_students
      from assessment_cycles c
               join assessment_cycle_district_school_mapping dsm
                    on c.id = dsm.cycle_id and dsm.udise = $1 and dsm.cycle_id = $2
                        and c.id = $2
      group by c.id
      limit 1`, udise, cycleId);
    if (cycleDetails.length == 0) {
      // this udise is not mapped to any cycle for this examiner
      this.logger.warn(`This udise (${udise}) is not mapped to any cycle for this examiner (${mentorID})`);
      return true;  // returning true so that the queue job just terminate gracefully
    }

    // @ts-ignore prepare list of student ids
    const studentIds = [...cycleDetails[0].class_1_students[0], ...cycleDetails[0].class_2_students[0], ...cycleDetails[0].class_3_students[0]];
    // @ts-ignore
    const grade1Count = [...cycleDetails[0].class_1_students[0]].length ?? 10;
    // @ts-ignore
    const grade2Count = [...cycleDetails[0].class_2_students[0]].length ?? 10;
    // @ts-ignore
    const grade3Count = [...cycleDetails[0].class_3_students[0]].length ?? 10;

    // find the grade wise nipun percentage
    const query = `
      select grade,
             (
                 case
                     when t.grade = 1 then (count(t.student_id) * 100) / ${grade1Count}
                     when t.grade = 2 then (count(t.student_id) * 100) / ${grade2Count}
                     when t.grade = 3 then (count(t.student_id) * 100) / ${grade3Count}
                     else 0
                     end
                 )::int as percentage
      from (     
              select                             
              a.student_id,
              a.grade,
              bool_and(a.is_passed) is_passed
              from assessments a
              where a.student_id = ANY($3::text[])
              and udise = $1
              and grade in (1,2,3)
              and mentor_id = $2
              and a.submitted_at between '${moment(cycleDetails[0].start_date).format('YYYY-MM-DD')}' and '${moment(cycleDetails[0].end_date).format('YYYY-MM-DD')}'
              and a.is_valid = true
              group by a.student_id, a.grade 
            ) t
      where t.is_passed = true
      group by t.grade    
    `;
    this.logger.debug(query)
    const gradeWisePercentage: Array<{ grade: number, percentage: number }> = await this.prismaService.$queryRawUnsafe(
      query, udise, mentorID, studentIds
    );
    this.logger.debug("Gradewise percentage for students", gradeWisePercentage)
    // the school will be nipun if all 3 grades are nipun
    let isNipun = true;
    if (gradeWisePercentage.length != 3) {
      // i.e. not all class assessments has been done (OR) no Nipun student percentage - the school is NOT_NIPUN
      isNipun = false;
    } else if (gradeWisePercentage.filter((item:any) => {
      return item.grade == 1 && item.percentage < cycleDetails[0].class_1_nipun_percentage;
    }).length) {
      // i.e. grade 1 % < cycle defined percentage
      isNipun = false;
    } else if (gradeWisePercentage.filter((item:any) => {
      return item.grade == 2 && item.percentage < cycleDetails[0].class_2_nipun_percentage;
    }).length) {
      // i.e. grade 2 % < cycle defined percentage
      isNipun = false;
    } else if (gradeWisePercentage.filter((item:any) => {
      return item.grade == 3 && item.percentage < cycleDetails[0].class_3_nipun_percentage;
    }).length) {
      // i.e. grade 3 % < cycle defined percentage
      isNipun = false;
    }
    this.logger.debug(`School Nipun status: ${isNipun}`);

    return this.prismaService.assessment_cycle_school_nipun_results.upsert({
      where: {
        cycle_id_udise_mentor_id: {
          cycle_id: cycleId,
          udise: udise,
          mentor_id: mentorID,
        },
      },
      create: {
        cycle_id: cycleId,
        udise: udise,
        mentor_id: mentorID,
        is_nipun: isNipun,
      }, update: {
        is_nipun: isNipun,
        updated_at: new Date()
      },
    });
  }

  async createSchoolListFromFile(
    file: any,
  ): Promise<CreateSchoolListResponseDto> {
    const buffer = await file.toBuffer();
    const parsedData: SchoolListExcelDataDto[] = await this.parseExcel(buffer);
    return await this.createSchoolListFromFileData(parsedData);
  }

  async createSchoolListFromFileData(
    data: SchoolListExcelDataDto[],
  ): Promise<CreateSchoolListResponseDto> {
    // Initialize empty arrays for success and failure lists
    const successSchoolList: SchoolListResponse[] = [];
    const failureSchoolList: SchoolListResponse[] = [];

    // to iterate over data concurrently using Promise.all
    await Promise.all(
      data.map(async (element) => {
        const { block, nypanchayat, district } = element;

        // Find district details
        const districtDetails = await this.prismaService.districts.findUnique({
          where: { name: district },
        });
        const district_id = districtDetails?.id || -1; // giving default id as -1 to avoid entry

        // Find block details
        const blockDetail = await this.prismaService.blocks.findUnique({
          where: { district_id_name: { district_id, name: block } },
        });
        const block_id = blockDetail?.id || -1;

        let nyay_panchayat_id = undefined;

        // Check for nypanchayat existence
        if (nypanchayat && district_id !== -1 && block_id !== -1) {
          const nypanchayatDetails =
            await this.prismaService.nyay_panchayats.findUnique({
              where: {
                name_district_id_block_id: {
                  block_id,
                  district_id,
                  name: nypanchayat,
                },
              },
            });
          nyay_panchayat_id = nypanchayatDetails?.id;
        }

        // Create payload for creating/updating entries in DB
        const payload: CreateSchoolListDto = {
          ...element,
          block_id,
          district_id,
          nyay_panchayat_id,
        };

        try {
          // Upsert using prisma and handle success/failure cases
          const response: any = await this.prismaService.school_list.upsert({
            where: { udise: payload.udise },
            update: payload,
            create: payload,
          });
          successSchoolList.push(response);
        } catch (error) {
          const { errorMessage } = getPrismaErrorStatusAndMessage(error);
          failureSchoolList.push({ ...payload, message: errorMessage });
        }
      }),
    );

    return { successSchoolList, failureSchoolList };
  }

  async parseExcel(buffer: Buffer): Promise<SchoolListExcelDataDto[]> {
    try {
      // 1. Read the Excel file using XLSX and get the first sheet and data
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data: any = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // 2. Array manipulation
      const parsedData = data
        .slice(1) // Start from the second row
        .map((row: any) => {
          const rowData: any = {};
          data[0].forEach((header: string, index: number) => {
            // Loop through each element in the first row (header)
            // 'header' stores the current header name (string) as it iterates
            // 'index' stores the current index (number) as it iterates
            rowData[header] = row[index]?.toString().trim(); // Formatting with trimming
          });
          return rowData;
        });

      // 3. Additional data formatting
      parsedData.forEach((item: SchoolListExcelDataDto) => {
        // Convert 'udise', 'lat', 'long' and 'total_student_registered property to a number
        item.udise = Number(item.udise);
        item.lat = item.lat ? Number(item.lat) : undefined ;
        item.long = item.long ? Number(item.long) : undefined;
        item.total_student_registered =
          item.total_student_registered ? 
          Number(item.total_student_registered) : 0;

        // Convert 'geo_fence_enabled' and 'is_sankul' properties to boolean
        item.geo_fence_enabled = Boolean(
          item.geo_fence_enabled.toString().toLowerCase() === 'true',
        );
        item.is_sankul = Boolean(
          item.is_sankul.toString().toLowerCase() === 'true',
        );
      });

      // 4. Return the final parsed data
      return parsedData;
    } catch (error) {
      throw new BadRequestException('Failed to parse Excel file');
    }
  }
}
