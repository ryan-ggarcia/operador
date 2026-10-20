import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/public/index.js';
import { CrmModule } from '../crm/public/index.js';
import { FinanceModule } from '../finance/public/index.js';
import { MediaModule } from '../media/public/index.js';
import { ProjectsModule } from '../projects/public/index.js';
import { SettingsModule } from '../settings/public/index.js';
import { TimesheetModule } from '../timesheet/public/index.js';
import { AiChatService } from './ai-chat.service.js';
import { AiController } from './ai.controller.js';
import { claudeProvider } from './claude.client.js';
import { AiToolsService } from './tools/ai-tools.service.js';

/** Integração com o Claude (só leitura, pelas fachadas dos outros módulos). */
@Module({
  imports: [AuthModule, CrmModule, SettingsModule, ProjectsModule, TimesheetModule, FinanceModule, MediaModule],
  controllers: [AiController],
  providers: [claudeProvider, AiToolsService, AiChatService],
})
export class AiModule {}
