import { Injectable } from '@nestjs/common';
import { AppService } from '../app.service';

@Injectable()
export class V2Service extends AppService {

  async test() {
    return {}
  }
}
