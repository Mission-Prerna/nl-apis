import { Test, TestingModule } from '@nestjs/testing';
import { V2Service } from './v2.service';

describe('V2Service', () => {
  let service: V2Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [V2Service],
    }).compile();

    service = module.get<V2Service>(V2Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
