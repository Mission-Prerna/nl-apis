export enum AssessmentVisitResultsStudentModule {
  ODK = 'odk',
  BOLO = 'bolo',
}

export type Mentor = {
  id: bigint;
  phone_no: string;
  district_id: number;
  block_id: number;
};
