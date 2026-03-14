import {
    Controller,
    Post,
    Get,
    Param,
    Res,
    UseInterceptors,
    UploadedFile,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { S3Service } from './s3.service';
import { existsSync } from 'fs';
import { join } from 'path';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
    private readonly logger = new Logger(StorageController.name);

    constructor(private readonly s3Service: S3Service) { }

    @Post('upload')
    @ApiOperation({ summary: 'Upload an image' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 2 }), // 2MB max (client compresses first)
                    new FileTypeValidator({ fileType: /.(jpg|jpeg|png|webp|avif)$/ }),
                ],
            }),
        )
        file: any,
    ) {
        // Generate a unique clean filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
        const key = `uploads/${uniqueSuffix}.${ext}`;

        this.logger.log(`Handling upload for file: ${file.originalname} (${file.size} bytes)`);

        const url = await this.s3Service.upload(key, file.buffer, file.mimetype);

        return {
            success: true,
            url,
            message: 'File uploaded successfully',
        };
    }

    @Get('local/:path(*)')
    async getLocalFile(@Param('path') paramPath: string, @Res() res: Response) {
        try {
            // Retrieve localFallbackDir from S3Service cleanly
            const localFallbackDir = (this.s3Service as any).localFallbackDir;
            if (!localFallbackDir) {
                throw new NotFoundException('Local storage is not configured');
            }

            // Prevent directory traversal attacks
            const safePath = paramPath.replace(/\.\./g, '');
            const absolutePath = join(localFallbackDir, safePath);

            if (!existsSync(absolutePath)) {
                throw new NotFoundException('File not found');
            }

            res.sendFile(absolutePath);
        } catch (error) {
            this.logger.error(`Error serving local file: ${paramPath}`, error);
            throw new NotFoundException('File not found');
        }
    }
}
