import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import {
  ActorEnum,
  AssessmentTypeEnum,
  Mentor,
  Student,
  StudentMonthlyAssessmentStatus,
  TypeAssessmentQuarterTables,
  TypeTeacherHomeOverview,
} from '../enums';
import { AppService } from '../app.service';
import { PrismaService } from '../prisma.service';
import { Cache } from 'cache-manager';

const moment = require('moment');

@Injectable()
export class SchoolService {
  protected readonly logger = new Logger(SchoolService.name);

  constructor(
    protected readonly prismaService: PrismaService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
    protected readonly appService: AppService,
  ) {}

  async getSchoolStudents(udise: number): Promise<Array<Student>> {
    const response = await this.prismaService.students.findMany({
      where: {
        udise: BigInt(parseInt(udise.toString())),
        grade: {
          in: [1, 2, 3]
        }
      },
      select: {
        unique_id: true,
        name: true,
        grade: true,
      }
    });
    return response.map((item) => {
      return {
        id: item.unique_id,
        name: item.name,
        grade: item.grade
      }
    });
  }

  async getSchoolStudentsResults(mentor: Mentor, udise: number, grades: Array<Number>, year: number, month: number) {
    const tables = this.appService.getAssessmentVisitResultsTables(year, month);
    const firstDayTimestamp = Date.UTC(year, month - 1, 1, 0, 0, 0);  // first day of current month
    const lastDayTimestamp = Date.UTC(year, month, 1, 0, 0, 0); // 1st day of next month

    const query = `
      select distinct on (student_id) student_id as id,
                                           submission_timestamp last_assessment_date,
                                           is_passed
      from ${tables.assessment_visit_results_students}
      where mentor_id = ${mentor.id}
        and student_id is not null
        and submission_timestamp > ${firstDayTimestamp}
        and submission_timestamp < ${lastDayTimestamp}
        and grade in (${grades.join(',')})
      order by student_id, submission_timestamp DESC
    `;
    const studentWiseResults: Record<string, Student> = {};
    const result: Array<Student> = await this.prismaService.$queryRawUnsafe(query);
    result.forEach((res) => {
      // iterate and create a map student id wise for later faster fetching
      studentWiseResults[res.id.toString()] = res;
    });

    // Grade summary
    const gradeStudents: Record<string, {students: Array<Student>, nipun: number, not_nipun: number}> = {};
    (await this.getSchoolStudents(udise)).forEach(({ grade, id }: Student) => {
      grade = grade ?? 0; // just a ts check
      const assessedStudent = studentWiseResults[id.toString()] ?? null;
      if (!gradeStudents.hasOwnProperty(grade)) {
        gradeStudents[grade] = {
          students: [],
          nipun: 0,
          not_nipun: 0,
        }
      }
      if (assessedStudent) {
        assessedStudent.is_passed ? gradeStudents[grade].nipun++ : gradeStudents[grade].not_nipun++;
        gradeStudents[grade].students.push({
          id: id,
          status: assessedStudent.is_passed ? StudentMonthlyAssessmentStatus.PASS : StudentMonthlyAssessmentStatus.FAIL,
          last_assessment_date: assessedStudent.last_assessment_date,
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
    for (const grade of grades) {
      response.push({
        grade: grade,
        period: moment(month, 'M').format('MMMM') + ' माह',
        summary: [
          {
            label: 'Total',
            colour: '#FF0000',
            count: gradeStudents[grade.toString()].students.length
          },
          {
            label: 'Nipun',
            colour: '#FFFFFF',
            count: gradeStudents[grade.toString()].nipun
          },
          {
            label: 'Not Nipun',
            colour: '#000000',
            count: gradeStudents[grade.toString()].not_nipun
          },
          {
            label: 'Not assessed',
            colour: '#000000',
            count: (gradeStudents[grade.toString()].students.length - gradeStudents[grade.toString()].nipun - gradeStudents[grade.toString()].not_nipun)
          }
        ],
        students: gradeStudents[grade.toString()].students
      });
    }
    return response;
  }

  async getSchoolStudentsResultsSummary(mentor: Mentor, udise: number, grades: Array<Number>, xMonths: number = 12) {
    // find out all the months for which we wanted to fetch summary data for
    const globalStartDate = moment('2023-09-01');  // the date post which this feature was made live
    let startDate = moment(globalStartDate).subtract(xMonths, 'months').startOf('month');
    const now = moment();
    const monthsForQuery: Array<{year: number, month: number}> = [];
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

    const query = `
      select t.grade,
        count(t.student_id)                                        as assessed,
        count(case when t.is_passed is true then t.student_id end) as nipun
      from (
        select distinct on (avrs.student_id) student_id,
          avrs.grade,
          avrs.created_at,
          avrs.is_passed
        from %table_student% avrs 
        join %table_v2% avr2 on (
          avrs.assessment_visit_results_v2_id = avr2.id and avr2.udise = ${udise}
        )
        where avrs.student_id is not null
          and avrs.submission_timestamp > %start_time%
          and avrs.submission_timestamp < %end_time%
          and avrs.grade in (%grades%)
         order by avrs.student_id, avrs.created_at DESC
           ) t
      group by grade;
    `;

    const gradeWiseSummary: Record<string, any> = {};
    let summaries: Record<string, object> = {};
    monthsForQuery.forEach(item => {
      const monthName = moment().month(item.month).year(item.year).date(1).format('MMMM');
      summaries[monthName] = {
        period: monthName,
        total: 0,
        assessed: 0,
        successful: 0
      }
    })
    for (let grade of grades) {
      let summary = JSON.parse(JSON.stringify(summaries)); // we needed deep copy of `summaries` object
      const gradeTotal = await this.prismaService.students.count({
        where: {
          udise: udise,
          grade: parseInt(grade.toString())
        }
      });

      // set total for each summary object
      Object.entries(summary).forEach(key => {
        summary[key[0]].total = gradeTotal;
      })
      gradeWiseSummary[grade.toString()] = {
        grade: grade,
        summary: summary,
      }
    }
    for (const item of monthsForQuery) {
      const tables = this.appService.getAssessmentVisitResultsTables(item.year, item.month+1);
      const result: Array<Record<string, number>> = await this.prismaService.$queryRawUnsafe(
        query
          .replace('%table_student%', tables.assessment_visit_results_students)
          .replace('%table_v2%', tables.assessment_visit_results_v2)
          .replace('%mentor_id%', mentor.id.toString())
          .replace('%start_time%', (moment().month(item.month).year(item.year).date(1).utc().startOf('day').unix() * 1000).toString())
          .replace('%end_time%', (moment().month(item.month+1).year(item.year).date(1).utc().startOf('day').unix() * 1000).toString())
          .replace('%grades%', grades.join(','))
      );
      for (const row of result) {
        gradeWiseSummary[row.grade.toString()].summary[moment().month(item.month).year(item.year).date(1).format('MMMM')].assessed = row.assessed;
        gradeWiseSummary[row.grade.toString()].summary[moment().month(item.month).year(item.year).date(1).format('MMMM')].successful = row.nipun;
      }
    }

    let response = Object.values(gradeWiseSummary); // remove grade keys from `gradeWiseSummary` object
    for (let item of response) {
      item.summary = Object.values(item.summary); // remove month name keys from summary objects
    }
    return response;
  }

  async getTeacherStudentsSummaryResultForPeriod(
    tables: TypeAssessmentQuarterTables,
    mentor: Mentor,
    udise: number,
    firstDayTimestamp: number,
    lastDayTimestamp: number): Promise<TypeTeacherHomeOverview | null> {
    try {
      const query = `
        select count(distinct student_id)                                     as assessments_total,
               count(distinct case when is_passed = true then student_id end) as nipun_total
        from (
          select distinct on (student_id) student_id,
                                         assessment_visit_results_v2_id
                                             submission_timestamp,
                                         is_passed
          from ${tables.assessment_visit_results_students} avrs
                  join ${tables.assessment_visit_results_v2} as avr2
                       on (avr2.id = avrs.assessment_visit_results_v2_id and avr2.actor_id = ${ActorEnum.TEACHER} and
                           avr2.assessment_type_id = ${AssessmentTypeEnum.NIPUN_ABHYAS} and avr2.udise = ${udise})
          where avrs.mentor_id = ${mentor.id}
           and avrs.student_id is not null
           and avrs.submission_timestamp > ${firstDayTimestamp}
           and avrs.submission_timestamp < ${lastDayTimestamp}
          order by student_id, submission_timestamp DESC
          ) t
      `;
      const result: Array<TypeTeacherHomeOverview> = await this.prismaService.$queryRawUnsafe(query);
      return {
        assessments_total: result[0].assessments_total,
        nipun_total: result[0].nipun_total
      };
    } catch (e) {
      this.logger.error(`Error occurred: ${e}`);
      this.appService.handleRequestError(e);
    }
    return null;
  }

  async getSchoolTeacherPerformance(mentor: Mentor, udise: number) {
    const lastDate = new Date();  // it's now() basically
    const temp = new Date();
    const day = lastDate.getDay(), diff = lastDate.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    const firstDate = new Date(temp.setDate(diff));

    const tablesForFirstDate = this.appService.getAssessmentVisitResultsTables(firstDate.getFullYear(), firstDate.getMonth() + 1);
    const tablesForLastDate = this.appService.getAssessmentVisitResultsTables(lastDate.getFullYear(), lastDate.getMonth() + 1);

    let responseFirstTable: TypeTeacherHomeOverview | null;
    let responseSecondTable = null;
    if (tablesForFirstDate.assessment_visit_results_v2 === tablesForLastDate.assessment_visit_results_v2) {
      // both tables are same
      const firstDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0);
      const lastDayTimestamp = lastDate.getTime();

      responseFirstTable = await this.getTeacherStudentsSummaryResultForPeriod(
        tablesForFirstDate,
        mentor,
        udise,
        firstDayTimestamp,
        lastDayTimestamp
      );
    } else {
      // if the data needs to queried from two tables, we'll query for both separately
      let firstDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0);
      let lastDayTimestamp = Date.UTC(firstDate.getFullYear(), firstDate.getMonth() + 1, 1, 0, 0, 0); // next month's first date
      responseFirstTable = await this.getTeacherStudentsSummaryResultForPeriod(
        tablesForFirstDate,
        mentor,
        udise,
        firstDayTimestamp,
        lastDayTimestamp
      );

      firstDayTimestamp = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), 1, 0, 0, 0);  // first day of current month
      lastDayTimestamp = lastDate.getTime();

      responseSecondTable = await this.getTeacherStudentsSummaryResultForPeriod(
        tablesForLastDate,
        mentor,
        udise,
        firstDayTimestamp,
        lastDayTimestamp
      );
    }
    let weekly = responseFirstTable;
    if (responseSecondTable) {
      // we need to merge both table's response
      weekly = {
        assessments_total: (responseFirstTable?.assessments_total || 0) + (responseSecondTable?.assessments_total || 0),
        nipun_total: (responseFirstTable?.nipun_total || 0) + (responseSecondTable?.nipun_total || 0),
      }
    }

    const currentMonthName = moment().utc().format('MMMM');
    const currentMonth = moment().utc().month() + 1;
    const currentYear = moment().utc().year();
    const currentMonthStartTimestamp = moment().utc().startOf('month').unix()*1000; // in milliseconds
    const currentMonthEndTimestamp = moment().utc().unix()*1000;  // in milliseconds
    const currentMonthTables = this.appService.getAssessmentVisitResultsTables(currentYear, currentMonth);
    const currentMonthStats = await this.getTeacherStudentsSummaryResultForPeriod(
      currentMonthTables,
      mentor,
      udise,
      currentMonthStartTimestamp,
      currentMonthEndTimestamp
    );

    const lastMonthName = moment().utc().subtract(1, 'month').format('MMMM');
    const lastMonth = (currentMonth == 1) ? 12 : (currentMonth - 1);
    const lastYear = (currentMonth == 1) ? (currentYear - 1) : currentYear;
    const lastMonthStartTimestamp = moment().utc().subtract(1, 'month').startOf('month').unix()*1000; // in milliseconds
    const lastMonthEndTimestamp = moment().utc().subtract(1, 'month').endOf('month').unix()*1000; // in milliseconds
    const lastMonthTables = this.appService.getAssessmentVisitResultsTables(lastYear, lastMonth);
    const lastMonthStats = await this.getTeacherStudentsSummaryResultForPeriod(
      lastMonthTables,
      mentor,
      udise,
      lastMonthStartTimestamp,
      lastMonthEndTimestamp
    );

    return [
      {
        period: "Weekly",
        insights: [
          {
            label: "Assessed students",
            count: weekly?.assessments_total ?? 0
          },
          {
            label: "Nipun students",
            count: weekly?.nipun_total ?? 0
          }
        ]
      },
      {
        period: currentMonthName,
        insights: [
          {
            label: "Assessed students",
            count: currentMonthStats?.assessments_total ?? 0
          },
          {
            label: "Nipun students",
            count: currentMonthStats?.nipun_total ?? 0
          }
        ]
      },
      {
        period: lastMonthName,
        insights: [
          {
            label: "Assessed students",
            count: lastMonthStats?.assessments_total ?? 0
          },
          {
            label: "Nipun students",
            count: lastMonthStats?.nipun_total ?? 0
          }
        ]
      }
    ];
  }
}
