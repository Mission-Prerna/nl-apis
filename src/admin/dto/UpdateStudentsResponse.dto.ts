export class StudentsUpdateResponseDto {
  readonly message: string;
  readonly failedStudentUpdates: StudentsUpdateResponse[];
  readonly successStudentUpdates: StudentsUpdateResponse[];
}

export class StudentsUpdateResponse {
  readonly unique_id: string;
  readonly message: string;
}
