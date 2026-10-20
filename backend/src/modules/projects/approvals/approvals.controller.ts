import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../../shared/auth/current-user.decorator.js';
import type { AuthUser } from '../../../shared/auth/auth-user.js';
import { CurrentAccess, RequireAccess, type UserPermissions } from '../../auth/public/index.js';
import { ApprovalListDto, ApprovalMarkerDto, ApprovalRequestDto, ApprovalVoteDto } from '../dto/approvals.dto.js';
import { ApprovalsService } from './approvals.service.js';

@Controller('approvals')
@RequireAccess(['projects', 'jobs'])
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Query() query: ApprovalListDto) {
    return this.approvals.list(user.id, access, query.docType, query.docId);
  }

  @Get('pending')
  pending(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions) {
    return this.approvals.pending(user.id, access);
  }

  @Post()
  request(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Body() body: ApprovalRequestDto) {
    return this.approvals.request(user.id, access, body);
  }

  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  vote(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApprovalVoteDto,
  ) {
    return this.approvals.vote(user.id, access, id, body.decision, body.reason ?? null);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.cancel(user.id, access, id);
  }

  @Post(':id/markers')
  addMarker(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApprovalMarkerDto,
  ) {
    return this.approvals.addMarker(user.id, access, id, body);
  }

  @Delete(':id/markers/:markerId')
  removeMarker(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('markerId', ParseUUIDPipe) markerId: string,
  ) {
    return this.approvals.removeMarker(user.id, access, id, markerId);
  }
}
