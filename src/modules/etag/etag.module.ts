import { CacheModule, Module } from '@nestjs/common';
import { EtagService } from './etag.service';

@Module({
  imports: [CacheModule.register()],
  providers: [EtagService],
  exports: [EtagService],
})
export class EtagModule {}
