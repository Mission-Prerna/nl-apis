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
  TTL_MENTOR_FROM_TOKEN = 30 * 1000, // converted to milliseconds
}