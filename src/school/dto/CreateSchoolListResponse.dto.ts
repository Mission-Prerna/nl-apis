export class SchoolListResponse {
  readonly udise: number;
  readonly district: string;
  readonly area_type: string;
  readonly block: string;
  readonly nypanchayat: string;
  readonly is_sankul: boolean;
  readonly geo_fence_enabled: boolean;
  readonly type?: string;
  readonly category?: string;
  readonly name?: string;
  readonly udise_code?: string;
  readonly total_student_registered?: number;
  readonly lat?: number;
  readonly long?: number;
  readonly district_id: number;
  readonly nyay_panchayat_id?: number;
  readonly id?: number;
  readonly message?: string;
}

export class CreateSchoolListResponseDto {
  message?: string;
  failureSchoolList: SchoolListResponse[];
  successSchoolList: SchoolListResponse[];
}
