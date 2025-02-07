import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';
import { FileSystemStoredFile } from 'nestjs-form-data';
import * as fs from 'fs/promises';

@Injectable()
export class MinioService {

  private readonly minioClient: Minio.Client;
  private readonly minioUrl: string;
  private readonly enableSSL: boolean;
  private readonly logger = new Logger(MinioService.name)

  constructor(protected readonly configService: ConfigService) {
    this.minioUrl = this.configService.getOrThrow<string>('MINIO_URL');
    this.enableSSL = this.configService.getOrThrow<string>('MINIO_USE_SSL') === 'true'
    this.minioClient = new Minio.Client({
      endPoint: this.minioUrl,
      useSSL: this.enableSSL,
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
       // Get the presigned URL for the uploaded object
       const presignedUrl = await this.minioClient.presignedGetObject(bucketName, objectName);
       const url = presignedUrl.split('?')[0]
       return url
    } catch (error : any) {
      this.logger.error(`Error uploading zip file: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to upload zip file. ${error.message}`);
    }
  }

  async uploadFileToMinio(file: FileSystemStoredFile, bucketName: string, fileName?: string): Promise<string> {
    const fileOriginalName = file.originalName;
    const fileExtension = fileOriginalName.split('.').pop();
    const formattedDate = new Date().toISOString().slice(0, 19).replace(/[-T:/]/g, '');
    const objectName = fileName 
    ? `${(fileName).trim()}_${formattedDate}.${fileExtension}` 
    : `${fileOriginalName.substring(0, fileOriginalName.lastIndexOf('.'))}_${formattedDate}.${fileExtension}`;

    try {
      // Read the file into a buffer
      const fileBuffer = await fs.readFile(file.path);
  
      // Upload the file to MinIO
      await this.minioClient.putObject(bucketName, objectName, fileBuffer);
  
      // Get the presigned URL for the uploaded object
      const presignedUrl = await this.minioClient.presignedGetObject(bucketName, objectName);
      const url = presignedUrl.split('?')[0];
      return url;
    } catch (error: any) {
      this.logger.error(`Error uploading assessment proof file: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to upload assessment proof file. ${error.message}`);
    }
  }
}
