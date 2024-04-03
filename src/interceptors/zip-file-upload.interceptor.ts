import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ZipFileUploadInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    const file = await request.file();

    if (!file) {
      throw new NotFoundException('No file uploaded');
    }

    // Check file type (ZIP)
    const allowedFileTypes = ['application/zip', "application/x-zip-compressed", "application/x-zip", "application/x-compress", "multipart/x-zip"];

    if (!allowedFileTypes.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        'Invalid file type. Only ZIP files are allowed',
      );
    }

    // Check file size
    const maxFileSize = 20 * 1024 * 1024; // 20MB
    const fileSize = file?.file?.bytesRead || 0;
    if (file.file && fileSize > maxFileSize) {
      throw new PayloadTooLargeException(
        'File size exceeds the allowed limit (20MB)',
      );
    }

    // Set the file on the request object for later retrieval in the controller
    request['processedFile'] = file;

    return next.handle();
  }
}
