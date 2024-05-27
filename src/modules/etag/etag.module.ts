import { Module } from '@nestjs/common';
import { EtagService } from './etag.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register()
  ],
  providers: [EtagService],
  exports: [EtagService],
})
export class EtagModule {}
