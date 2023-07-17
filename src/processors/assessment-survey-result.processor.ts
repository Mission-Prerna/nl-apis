import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { AppService } from '../app.service';
import { QueueEnum, JobEnum as JobEnum } from '../enums';
import * as Sentry from '@sentry/node';

@Processor(QueueEnum.AssessmentSurveyResult)
export class AssessmentSurveyResultProcessor {
  private readonly logger = new Logger(AssessmentSurveyResultProcessor.name);
  constructor(
    private readonly appService: AppService,
  ) {}

  @Process(JobEnum.CreateAssessmentSurveyResult)
  async createSurveyResult(job: Job) {
    // @ts-ignore
    return await this.appService.createAssessmentSurveyResult(job.data);
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
    let mentorId = job.data.mentor_id || null;
    if (mentorId) {
      mentorId = mentorId + ''; // make it string
    }
    Sentry.captureException(err, {
      user: {
        id: mentorId
      }
    });
    this.logger.error(
      `Failed job ${job.id} of type ${job.name}...`,
    );
  }
}
