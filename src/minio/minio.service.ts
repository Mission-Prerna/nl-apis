import { Injectable } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import { log } from 'console';

@Injectable()
export class MinioService {

  private readonly minioClient: Minio.Client;
  private readonly minioUrl: string;
  private readonly minioPort: number;

  constructor(protected readonly configService: ConfigService) {
    this.minioUrl = this.configService.getOrThrow<string>('MINIO_URL');
    this.minioPort = this.configService.getOrThrow<number>('MINIO_PORT');
    this.minioClient = new Minio.Client({
      endPoint: this.minioUrl,
      port: +this.minioPort,
      useSSL: false, // Change to true if your Minio server uses SSL
      accessKey: this.configService.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: this.configService.getOrThrow<string>('MINIO_SECRET'),
    });
  }

  async uploadZip(zipFile: any): Promise<string> {
    const bucketName = this.configService.getOrThrow<string>('MINIO_BUCKET');
    const filename = zipFile.filename
    const formattedDate = new Date().toISOString().slice(0, 19).replace(/[-T:/]/g, ''); 
    const objectName = `${filename.substring(0, filename.lastIndexOf('.'))}_${formattedDate}.zip`;

    try {
      await this.minioClient.putObject(bucketName, objectName, await zipFile.toBuffer()); 
      return `http://${this.minioUrl}:${this.minioPort}/${bucketName}/${objectName}`
    } catch (error : any) {
      throw new Error(`Failed to upload zip file: ${error.message}`);
    }

  }
}
