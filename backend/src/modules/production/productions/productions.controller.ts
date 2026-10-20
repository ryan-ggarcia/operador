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
  Put,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/auth/auth-user.js';
import { CurrentUser } from '../../../shared/auth/current-user.decorator.js';
import { CurrentAccess, FULL, LoadAccess, RequireAccess, type UserPermissions } from '../../auth/public/index.js';
import { ProductionCatalogService } from '../catalog/production-catalog.service.js';
import {
  ApproveDto,
  CreateProductionDto,
  ItemDto,
  ItemSupplierDto,
  MembersDto,
  OrderDto,
  ProductionListDto,
  QuoteDto,
  StatusListDto,
  TaxDto,
  TextDto,
  TextListDto,
  UpdateItemSupplierDto,
  UpdateProductionDto,
} from '../dto/production.dto.js';
import { ProductionsService } from './productions.service.js';

const Uuid = (name: string) => Param(name, ParseUUIDPipe);

@Controller('productions')
@RequireAccess('productions')
export class ProductionsController {
  constructor(private readonly productions: ProductionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Query() query: ProductionListDto) {
    return this.productions.list(user.id, access, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string) {
    return this.productions.get(user.id, access, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Body() body: CreateProductionDto) {
    return this.productions.create(user.id, access, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string, @Body() body: UpdateProductionDto) {
    return this.productions.update(user.id, access, id, body);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string) {
    return this.productions.act(user.id, access, id, 'complete');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string) {
    return this.productions.act(user.id, access, id, 'cancel');
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string) {
    return this.productions.act(user.id, access, id, 'reopen');
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  addMembers(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string, @Body() body: MembersDto) {
    return this.productions.addMembers(user.id, access, id, body.userIds);
  }

  @Delete(':id/members/:userId')
  removeMember(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string, @Uuid('userId') memberId: string) {
    return this.productions.removeMember(user.id, access, id, memberId);
  }

  @Get(':id/history')
  history(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string) {
    return this.productions.history(user.id, access, id);
  }

  @Post(':id/items')
  addItem(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string, @Body() body: ItemDto) {
    return this.productions.addItem(user.id, access, id, body);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Uuid('id') id: string,
    @Uuid('itemId') itemId: string,
    @Body() body: ItemDto,
  ) {
    return this.productions.updateItem(user.id, access, id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  removeItem(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string, @Uuid('itemId') itemId: string) {
    return this.productions.removeItem(user.id, access, id, itemId);
  }

  @Post(':id/items/:itemId/suppliers')
  addSupplier(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Uuid('id') id: string,
    @Uuid('itemId') itemId: string,
    @Body() body: ItemSupplierDto,
  ) {
    return this.productions.addSupplier(user.id, access, id, itemId, body);
  }

  @Patch(':id/suppliers/:itemSupplierId')
  updateSupplier(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Uuid('id') id: string,
    @Uuid('itemSupplierId') itemSupplierId: string,
    @Body() body: UpdateItemSupplierDto,
  ) {
    return this.productions.updateSupplier(user.id, access, id, itemSupplierId, body);
  }

  @Delete(':id/suppliers/:itemSupplierId')
  removeSupplier(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Uuid('id') id: string,
    @Uuid('itemSupplierId') itemSupplierId: string,
  ) {
    return this.productions.removeSupplier(user.id, access, id, itemSupplierId);
  }

  @Put(':id/suppliers/:itemSupplierId/quotes')
  saveQuote(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Uuid('id') id: string,
    @Uuid('itemSupplierId') itemSupplierId: string,
    @Body() body: QuoteDto,
  ) {
    return this.productions.saveQuote(user.id, access, id, itemSupplierId, body);
  }

  @Post(':id/suppliers/:itemSupplierId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Uuid('id') id: string,
    @Uuid('itemSupplierId') itemSupplierId: string,
    @Body() body: ApproveDto,
  ) {
    return this.productions.approve(user.id, access, id, itemSupplierId, body.quantity);
  }

  @Patch(':id/orders/:orderId')
  updateOrder(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Uuid('id') id: string,
    @Uuid('orderId') orderId: string,
    @Body() body: OrderDto,
  ) {
    return this.productions.updateOrder(user.id, access, id, orderId, body);
  }

  @Post(':id/orders/:orderId/send-to-finance')
  @HttpCode(HttpStatus.OK)
  sendOrder(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string, @Uuid('orderId') orderId: string) {
    return this.productions.sendOrderToFinance(user.id, access, id, orderId);
  }

  @Post(':id/orders/:orderId/reopen-billing')
  @HttpCode(HttpStatus.OK)
  reopenOrder(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Uuid('id') id: string, @Uuid('orderId') orderId: string) {
    return this.productions.reopenOrderBilling(user.id, access, id, orderId);
  }
}

/** Configurações › Produção. Listar: quem usa; alterar: nível Total. */
@Controller('production-settings')
export class ProductionSettingsController {
  constructor(private readonly catalog: ProductionCatalogService) {}

  @Get('taxes')
  @LoadAccess()
  taxes() {
    return this.catalog.listTaxes();
  }

  @Post('taxes')
  @RequireAccess('productions', FULL)
  createTax(@Body() body: TaxDto) {
    return this.catalog.saveTax(null, { ...body, type: body.type ?? null, active: body.active ?? true });
  }

  @Patch('taxes/:id')
  @RequireAccess('productions', FULL)
  updateTax(@Uuid('id') id: string, @Body() body: TaxDto) {
    return this.catalog.saveTax(id, { ...body, type: body.type ?? null, active: body.active ?? true });
  }

  @Get('statuses')
  @LoadAccess()
  statuses(@Query() query: StatusListDto) {
    return this.catalog.listStatuses(query.includeInactive ?? false);
  }

  @Get('texts')
  @LoadAccess()
  texts(@Query() query: TextListDto) {
    return this.catalog.listTexts(query.kind);
  }

  @Post('texts')
  @RequireAccess('productions', FULL)
  createText(@Body() body: TextDto) {
    return this.catalog.saveText(null, { ...body, active: body.active ?? true });
  }

  @Patch('texts/:id')
  @RequireAccess('productions', FULL)
  updateText(@Uuid('id') id: string, @Body() body: TextDto) {
    return this.catalog.saveText(id, { ...body, active: body.active ?? true });
  }
}
