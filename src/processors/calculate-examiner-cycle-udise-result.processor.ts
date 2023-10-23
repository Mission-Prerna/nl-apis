import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { JobEnum as JobEnum, QueueEnum } from '../enums';
import * as Sentry from '@sentry/node';
import { SchoolServiceV2 } from '../school/school.service.v2';

@Processor(QueueEnum.CalculateExaminerCycleUdiseResult)
export class CalculateExaminerCycleUdiseResultProcessor {
  private readonly logger = new Logger(CalculateExaminerCycleUdiseResultProcessor.name);

  constructor(
    private readonly service: SchoolServiceV2,
  ) {
  }

  @Process(JobEnum.ProcessExaminerCycleUdiseResult)
  async calculate(job: Job) {
    return await this.service.calculateExaminerCycleUdiseResult(job.data.mentor, job.data.cycle_id, job.data.udise);
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.debug(
      `Finished job ${job.id} of type ${job.name} with result ID: ${result.id}...`,
    );
  }

  // noinspection JSUnusedLocalSymbols
  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    let mentorId = job.data?.mentor?.id || null;
    if (mentorId) {
      mentorId = mentorId + ''; // make it string
    }
    Sentry.captureException(err, {
      user: {
        id: mentorId,
      },
      extra: {
        cycle_id: job.data.cycle_id,
        udise: job.data.udise,
      },
    });
    this.logger.error(
      `Failed job ${job.id} of type ${job.name}... ${err}`,
    );
  }
}
