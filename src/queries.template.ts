export function getAssessmentVisitResultsQuery(table: string) {
  return `
  create table ${table}
  (
      id                   bigserial                                      not null
          constraint ${table}_pkey
              primary key,
      created_at           timestamp with time zone default now()         not null,
      grade                smallint                                       not null,
      subject_id           integer                                        not null
          constraint ${table}_subject_id_fkey
              references subjects
              on update cascade on delete restrict,
      module_result        jsonb                                          not null,
      is_visited           boolean                  default false         not null,
      mentor_id            bigint
          constraint ${table}_mentor_id_fkey
              references mentor
              on update cascade on delete cascade,
      no_of_student        integer                  default 0             not null,
      actor_id             integer                                        not null
          constraint ${table}_actor_id_fkey
              references actors
              on update cascade on delete restrict,
      block_id             integer
          constraint ${table}_block_id_fkey
              references blocks
              on update cascade on delete restrict,
      assessment_type_id   integer,
      udise                bigint
          constraint ${table}_udise_fkey
              references school_list (udise)
              on update cascade on delete restrict,
      submission_timestamp bigint                   default '0'::bigint   not null,
      app_version_code     integer                  default 0             not null,
      v                    smallint                 default '2'::smallint not null,
      constraint ${table}_unique
          unique (udise, mentor_id, grade, subject_id, submission_timestamp)
  );
  
  create index ${table}_block_id_idx
      on ${table} (block_id);
  
  create index ${table}_subject_id_idx
      on ${table} (subject_id);
  
  create index ${table}_actor_id_idx
      on ${table} (actor_id);
  
  create index ${table}_actor_block_id_idx
      on ${table} (actor_id, block_id);
  
  create index ${table}_created_at_idx
      on ${table} (created_at);
  
  create index ${table}_ass_type_id_idx
      on ${table} (assessment_type_id);
  
  create index ${table}_udise_idx
      on ${table} (udise);
  
  create index ${table}_mentor_id_idx
      on ${table} (mentor_id);
  
  create index ${table}_cr_mntid_idx
      on ${table} (created_at, mentor_id);
  
  create index ${table}_sbsn_tz_idx
      on ${table} (submission_timestamp);
`;
}

export function getAssessmentVisitResultsStudentsQuery(
  student_table: string,
  assessment_table: string,
) {
  return `
  create table ${student_table}
  (
      id                             bigserial not null
          constraint ${student_table}_pkey
              primary key,
      student_name                   varchar   not null,
      competency_id                  integer   not null,
      module                         varchar   not null,
      end_time                       bigint    not null,
      is_passed                      boolean   not null,
      start_time                     bigint    not null,
      statement                      text,
      achievement                    integer   not null,
      total_questions                integer   not null,
      success_criteria               integer   not null,
      session_completed              boolean   not null,
      is_network_active              boolean   not null,
      workflow_ref_id                varchar   not null,
      assessment_visit_results_v2_id bigint    not null
          constraint ${student_table}_assessment_vi
              references ${assessment_table}
              on update cascade on delete cascade,
      student_session                uuid,
      total_time_taken               integer,
      constraint ${student_table}_ss_com_avr_v2_id
          unique (student_session, competency_id, assessment_visit_results_v2_id)
  );`;
}

export function getAssessmentVisitResultStudentOdkResultsQuery(
  odk_table: string,
  student_table: string,
) {
  return `
  create table ${odk_table}
  (
      id                                   bigserial not null
          constraint ${odk_table}_pkey
              primary key,
      question                             text      not null,
      answer                               varchar   not null,
      assessment_visit_results_students_id bigint    not null
          constraint ${odk_table}_fkey
              references ${student_table}
              on update cascade on delete cascade
  );`;
}
