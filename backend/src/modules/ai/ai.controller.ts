import { Body, Controller, Get, Post, Res, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../../shared/auth/auth-user.js';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import { CurrentAccess, LoadAccess, type UserPermissions } from '../auth/public/index.js';
import { AiChatService } from './ai-chat.service.js';
import { ChatDto } from './dto/chat.dto.js';

/** Assistente: qualquer usuário logado; as ferramentas filtram os dados pelas permissões. */
@Controller('ai')
export class AiController {
  constructor(private readonly chat: AiChatService) {}

  @Get('status')
  status() {
    return { enabled: this.chat.enabled };
  }

  /** Resposta em text/event-stream: linhas `data: <json>` (POST, então sem EventSource). */
  @Post('chat')
  @LoadAccess()
  async send(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Body() body: ChatDto,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.chat.enabled) {
      throw new ServiceUnavailableException('O assistente não está configurado (falta a chave da Claude API).');
    }
    const abort = new AbortController();
    response.on('close', () => abort.abort());
    response
      .status(200)
      .set({
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      .flushHeaders();
    for await (const event of this.chat.chat({ id: user.id, access }, body, abort.signal)) {
      if (response.writableEnded || abort.signal.aborted) break;
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    response.end();
  }
}
