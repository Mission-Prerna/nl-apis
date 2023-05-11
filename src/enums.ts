export enum AssessmentVisitResultsStudentModule {
  ODK = 'odk',
  BOLO = 'bolo',
}

export type Mentor = {
  id: bigint;
  phone_no: string;
  district_id: number;
  block_id: number | null;
};

export enum QueueEnum {
  AssessmentVisitResults = 'AssessmentVisitResults',
  AssessmentSurveyResult = 'AssessmentSurveyResult',
}

export enum JobEnum {
  CreateAssessmentVisitResults = 'CreateAssessmentVisitResults',
  CreateAssessmentSurveyResult = 'CreateAssessmentSurveyResult',
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