import { Injectable, Logger } from '@nestjs/common';
import { AppService } from '../app.service';

@Injectable()
export class V2Service extends AppService {
  protected readonly logger = new Logger(V2Service.name);
}
