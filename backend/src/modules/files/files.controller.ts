import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  Delete,
  ExceptionFilter,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  PayloadTooLargeException,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Public } from '../../shared/auth/public.decorator.js';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import type { AuthUser } from '../../shared/auth/auth-user.js';
import { CurrentAccess, LoadAccess, type UserPermissions } from '../auth/public/index.js';
import { contentDisposition, formatBytes } from './domain/file-rules.js';
import { DescribeFileDto, DownloadQueryDto, OwnerDto } from './dto/files.dto.js';
import { FilesService, type UploadedContent } from './files.service.js';

export const MAX_FILES_PER_UPLOAD = 20;

/** Troca a mensagem em inglês do multer ("File too large") por uma em português. */
@Catch(PayloadTooLargeException)
export class UploadLimitFilter implements ExceptionFilter {
  constructor(private readonly files: FilesService) {}

  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(413)
      .json({
        statusCode: 413,
        error: 'Payload Too Large',
        message: `Cada arquivo pode ter no máximo ${formatBytes(this.files.maxFileBytes)}.`,
      });
  }
}

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  @LoadAccess()
  list(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Query() owner: OwnerDto) {
    return this.files.list(user.id, access, owner.ownerType, owner.ownerId);
  }

  @Get('usage')
  @LoadAccess()
  usage() {
    return this.files.usage();
  }

  @Post()
  @LoadAccess()
  @UseFilters(UploadLimitFilter)
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD))
  upload(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Body() owner: OwnerDto,
    @UploadedFiles() uploads: UploadedContent[] | undefined,
  ) {
    return this.files.upload(user.id, access, owner.ownerType, owner.ownerId, uploads ?? []);
  }

  @Patch(':id')
  @LoadAccess()
  describe(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DescribeFileDto,
  ) {
    return this.files.describe(user.id, access, id, body.description ?? null);
  }

  @Delete(':id')
  @LoadAccess()
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.remove(user.id, access, id);
  }

  @Get(':id/url')
  @LoadAccess()
  url(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DownloadQueryDto,
  ) {
    return this.files.downloadUrl(user.id, access, id, query.inline ?? false);
  }

  /** Link assinado do storage local (o Supabase serve os próprios links). */
  @Get('content/:token')
  @Public()
  async content(@Param('token') token: string, @Res() response: Response): Promise<void> {
    const file = await this.files.readSigned(token);
    response
      .status(200)
      .set({
        'content-type': file.mimeType,
        'content-length': String(file.content.length),
        'content-disposition': contentDisposition(file.fileName, file.inline),
        'cache-control': 'private, max-age=300',
        'x-content-type-options': 'nosniff',
      })
      .end(file.content);
  }
}
