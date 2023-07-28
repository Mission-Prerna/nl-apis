export enum AssessmentVisitResultsStudentModule {
  ODK = 'odk',
  BOLO = 'bolo',
}

export type Mentor = {
  id: bigint;
  designation_id: number;
  district_id: number;
  block_id: number | null;
  officer_name: string;
  phone_no: string;
  actor_id: number;
  district_name: string;
  block_town_name: string;
  teacher_school_list_mapping?: null | {
    school_list: null | object
  }
};

export enum QueueEnum {
  AssessmentVisitResults = 'AssessmentVisitResults',
  AssessmentSurveyResult = 'AssessmentSurveyResult',
}

export enum JobEnum {
  CreateAssessmentVisitResults = 'CreateAssessmentVisitResults',
  CreateAssessmentSurveyResult = 'CreateAssessmentSurveyResult',
}

export enum ActorEnum {
  NULL = 0,
  MENTOR = 1,
  EXAMINER = 2,
  TEACHER = 3,
  DIET_MENTOR = 4,
  PARENT = 5,
}

export enum AssessmentTypeEnum {
  NIPUN_ABHYAS = 1,
  SUCHI_ABHYAS = 2,
  NIPUN_LAKSHYA = 3,
  NIPUN_SUCHI = 4,
  STATE_LED_ASSESSMENT = 5,
}

export enum SubjectEnum {
  NULL = 0,
  MATH = 1,
  HINDI = 2,
  ENGLISH = 2,
}

export enum CacheConstants {
  TTL_MENTOR_FROM_TOKEN = 600 * 1000, // converted to milliseconds
  TTL_MENTOR_SCHOOL_LIST = 600 * 1000, // converted to milliseconds
  TTL_MENTOR_HOME_OVERVIEW = 600 * 1000, // converted to milliseconds
  TTL_METADATA = 86400, // in seconds
}

export enum Role {
  OpenRole = 'OpenRole',
  Diet = 'DIET',
  Admin = 'Admin',
}

export type TypeAssessmentQuarterTables = {
  assessment_visit_results_v2: string;
  assessment_visit_results_students: string;
  assessment_visit_results_student_odk_results: string;
}

export type TypeActorHomeOverview = {
  assessments_total: number,
  nipun_total: number,
  assessments_today: number,
  nipun_today: number
}

export type TypeAssessmentQuarterTables = {
  assessment_visit_results_v2: string;
  assessment_visit_results_students: string;
  assessment_visit_results_student_odk_results: string;
}

export type TypeActorHomeOverview = {
  assessments_total: number,
  nipun_total: number,
  assessments_today: number,
  nipun_today: number
}

export function CacheKeyMentorDetail (phoneNumber: string) {
  return `mentor:detail:${phoneNumber}`;
}

export function CacheKeyMentorSchoolList (phoneNumber: string, month: number, year: number) {
  return `mentor:scl_list:${phoneNumber}:${year.toString()}:${month.toString()}`;
}

export function CacheKeyMentorHomeOverview (phoneNumber: string, month: number, year: number) {
  return `mentor:home_overview:${phoneNumber}:${year.toString()}:${month.toString()}`;
}