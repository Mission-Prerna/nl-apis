import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AppService } from '../app.service';
import { QueueEnum, JobEnum as JobEnum } from '../enums';

@Processor(QueueEnum.AssessmentVisitResults)
export class AssessmentVisitResultsProcessor {
  private readonly logger = new Logger(AssessmentVisitResultsProcessor.name);
  constructor(
    private configService: ConfigService,
    private readonly appService: AppService,
  ) {}

  @Process(JobEnum.CreateAssessmentVisitResults)
  async createAssessmentVisitResults(job: Job) {
    // @ts-ignore
    return await this.appService.createAssessmentVisitResult(job.data);
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

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Failed job ${job.id} of type ${job.name}...`,
    );
  }
}
