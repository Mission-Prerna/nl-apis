import { Controller } from '@nestjs/common';
import { V2Service } from './v2.service';

@Controller('api/v2')
export class V2Controller {
  constructor(
    private service: V2Service
  ) {}
}
