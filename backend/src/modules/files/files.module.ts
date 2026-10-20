import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/public/index.js';
import { FilesController, MAX_FILES_PER_UPLOAD, UploadLimitFilter } from './files.controller.js';
import { FilesService } from './files.service.js';
import { FILES_FACADE } from './public/files.facade.js';
import { FILES_REPOSITORY } from './repositories/files.repository.js';
import { PrismaFilesRepository } from './repositories/prisma-files.repository.js';
import { FILE_STORAGE } from './storage/file-storage.js';
import { LocalFileStorage } from './storage/local-file-storage.js';
import { SupabaseFileStorage } from './storage/supabase-file-storage.js';

@Module({
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Sem dest/storage, o multer guarda em memória (buffer), e o service envia ao storage.
        limits: { fileSize: Number(config.get('FILES_MAX_MB') || 100) * 1024 * 1024, files: MAX_FILES_PER_UPLOAD },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    UploadLimitFilter,
    { provide: FILES_REPOSITORY, useClass: PrismaFilesRepository },
    {
      // Com SUPABASE_URL, os anexos vão para o Supabase Storage; sem, para uma pasta local.
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get('SUPABASE_URL') ? new SupabaseFileStorage(config) : new LocalFileStorage(config),
    },
    { provide: FILES_FACADE, useExisting: FilesService },
  ],
  exports: [FILES_FACADE],
})
export class FilesModule {}
