import { Test, TestingModule } from '@nestjs/testing';
import { V2Controller } from './v2.controller';

describe('V2Controller', () => {
  let controller: V2Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [V2Controller],
    }).compile();

    controller = module.get<V2Controller>(V2Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
