import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/auth/auth-user.js';
import { CurrentUser } from '../../../shared/auth/current-user.decorator.js';
import { CurrentAccess, RequireAccess, type UserPermissions } from '../../auth/public/index.js';
import { BILLING_TYPES } from '../domain/media-math.js';
import {
  CreateMediaDto,
  GridDto,
  LineDto,
  MediaListDto,
  MembersDto,
  PieceDto,
  UpdateMediaDto,
} from '../dto/media.dto.js';
import { MediasService } from './medias.service.js';

@Controller('medias')
@RequireAccess('medias')
export class MediasController {
  constructor(private readonly medias: MediasService) {}

  /** Tipos de faturamento e o que cada um significa. */
  @Get('billing-types')
  billingTypes() {
    return Object.entries(BILLING_TYPES).map(([code, label]) => ({ code, label }));
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Query() query: MediaListDto) {
    return this.medias.list(user.id, access, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.medias.get(user.id, access, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Body() body: CreateMediaDto) {
    return this.medias.create(user.id, access, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMediaDto,
  ) {
    const { confirmClearGrids, ...changes } = body;
    return this.medias.update(user.id, access, id, changes, confirmClearGrids);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.medias.act(user.id, access, id, 'complete');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.medias.act(user.id, access, id, 'cancel');
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.medias.act(user.id, access, id, 'reopen');
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  addMembers(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MembersDto,
  ) {
    return this.medias.addMembers(user.id, access, id, body.userIds);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberId: string,
  ) {
    return this.medias.removeMember(user.id, access, id, memberId);
  }

  @Get(':id/history')
  history(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.medias.history(user.id, access, id);
  }

  @Post(':id/pieces')
  addPiece(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PieceDto,
  ) {
    return this.medias.addPiece(user.id, access, id, body.title);
  }

  @Patch(':id/pieces/:pieceId')
  renamePiece(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pieceId', ParseUUIDPipe) pieceId: string,
    @Body() body: PieceDto,
  ) {
    return this.medias.renamePiece(user.id, access, id, pieceId, body.title);
  }

  @Delete(':id/pieces/:pieceId')
  removePiece(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pieceId', ParseUUIDPipe) pieceId: string,
  ) {
    return this.medias.removePiece(user.id, access, id, pieceId);
  }

  @Post(':id/grids')
  addGrid(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: GridDto,
  ) {
    return this.medias.addGrid(user.id, access, id, body);
  }

  @Patch(':id/grids/:gridId')
  updateGrid(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gridId', ParseUUIDPipe) gridId: string,
    @Body() body: GridDto,
  ) {
    return this.medias.updateGrid(user.id, access, id, gridId, body);
  }

  @Delete(':id/grids/:gridId')
  removeGrid(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gridId', ParseUUIDPipe) gridId: string,
  ) {
    return this.medias.removeGrid(user.id, access, id, gridId);
  }

  @Post(':id/grids/:gridId/duplicate')
  duplicateGrid(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gridId', ParseUUIDPipe) gridId: string,
    @Body() body: GridDto,
  ) {
    return this.medias.duplicateGrid(user.id, access, id, gridId, body);
  }

  @Post(':id/grids/:gridId/lines')
  addLine(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gridId', ParseUUIDPipe) gridId: string,
    @Body() body: LineDto,
  ) {
    return this.medias.addLine(user.id, access, id, gridId, body);
  }

  @Patch(':id/lines/:lineId')
  updateLine(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() body: LineDto,
  ) {
    return this.medias.updateLine(user.id, access, id, lineId, body);
  }

  @Delete(':id/lines/:lineId')
  removeLine(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.medias.removeLine(user.id, access, id, lineId);
  }
}
