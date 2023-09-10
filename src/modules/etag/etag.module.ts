import { Module } from '@nestjs/common';
import { EtagService } from './etag.service';

@Module({
  providers: [EtagService],
  exports: [EtagService],
})
export class EtagModule {}
