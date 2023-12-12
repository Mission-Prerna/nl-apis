import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  
  constructor(private readonly configService: ConfigService) {
    let DB_URL = configService.get('NODE_ENV') === 'test' ? configService.get('TEST_DATABASE_URL') 
    : configService.get('DATABASE_URL');
    super({datasources: {db: {url: DB_URL}}});
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
