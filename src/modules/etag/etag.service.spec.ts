import { Test, TestingModule } from '@nestjs/testing';
import { EtagService } from './etag.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('EtagService', () => {
  let etagService: EtagService;
  let cacheManagerMock: jest.Mocked<Cache>;

  beforeEach(async () => {
    cacheManagerMock = {
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<Cache>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtagService,
        {
          provide: CACHE_MANAGER,
          useValue: cacheManagerMock,
        },
      ],
    }).compile();

    etagService = module.get<EtagService>(EtagService);
  });

  describe('getEtag', () => {
    it('should return an existing etag from cache', async () => {
      const cacheKey = 'testCacheKey';
      const existingEtag = 'existingEtag';

      cacheManagerMock.get.mockResolvedValue(existingEtag);

      const etag = await etagService.getEtag(cacheKey);

      expect(etag.etag).toBe(existingEtag);
      expect(cacheManagerMock.get).toHaveBeenCalledWith(cacheKey);
    });
  });
});
