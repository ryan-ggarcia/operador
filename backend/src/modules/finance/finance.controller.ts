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
import type { AuthUser } from '../../shared/auth/auth-user.js';
import { CurrentUser } from '../../shared/auth/current-user.decorator.js';
import { CurrentAccess, FULL, RequireAccess, type UserPermissions } from '../auth/public/index.js';
import { BillsService } from './bills/bills.service.js';
import { TreasuryService } from './bills/treasury.service.js';
import {
  AccountDto,
  BillListDto,
  CancelDto,
  CategoryDto,
  CreateBillDto,
  NamedDto,
  OptionalPeriodDto,
  PeriodDto,
  SettleDto,
  TransferDto,
  UpdateBillDto,
} from './dto/finance.dto.js';

@Controller('finance')
@RequireAccess('financial')
export class FinanceController {
  constructor(
    private readonly bills: BillsService,
    private readonly treasury: TreasuryService,
  ) {}

  @Get('bills')
  list(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Query() query: BillListDto) {
    return this.bills.list(user.id, access, query);
  }

  @Get('bills/:id')
  get(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.bills.get(user.id, access, id);
  }

  @Get('bills/:id/history')
  history(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.bills.history(user.id, access, id);
  }

  @Post('bills')
  create(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Body() body: CreateBillDto) {
    return this.bills.create(user.id, access, body);
  }

  @Patch('bills/:id')
  update(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBillDto,
  ) {
    return this.bills.update(user.id, access, id, body);
  }

  @Post('bills/settle')
  @HttpCode(HttpStatus.NO_CONTENT)
  settle(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Body() body: SettleDto) {
    return this.bills.settle(user.id, access, body.ids, body.paidAt);
  }

  @Post('bills/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @CurrentUser() user: AuthUser,
    @CurrentAccess() access: UserPermissions,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelDto,
  ) {
    return this.bills.cancel(user.id, access, id, body.scope);
  }

  @Post('bills/:id/reopen')
  @HttpCode(HttpStatus.NO_CONTENT)
  reopen(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.bills.reopen(user.id, access, id);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Query() query: PeriodDto) {
    return this.treasury.summary(user.id, access, query.from, query.to);
  }

  @Get('transfers')
  transfers(@Query() query: OptionalPeriodDto) {
    return this.treasury.listTransfers(query.from, query.to);
  }

  @Post('transfers')
  createTransfer(@CurrentUser() user: AuthUser, @CurrentAccess() access: UserPermissions, @Body() body: TransferDto) {
    return this.treasury.createTransfer(user.id, access, body);
  }

  @Delete('transfers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTransfer(@CurrentAccess() access: UserPermissions, @Param('id', ParseUUIDPipe) id: string) {
    return this.treasury.removeTransfer(access, id);
  }

  @Get('accounts')
  accounts() {
    return this.treasury.listAccounts();
  }

  @Get('categories')
  categories() {
    return this.treasury.listCategories();
  }

  @Get('payment-methods')
  paymentMethods() {
    return this.treasury.listNamed('paymentMethod');
  }

  @Get('cost-centers')
  costCenters() {
    return this.treasury.listNamed('costCenter');
  }

  @Get('statuses')
  statuses() {
    return this.treasury.listStatuses();
  }
}

/** Configurações › Financeiro: nível Total no financeiro. */
@Controller('finance-settings')
@RequireAccess('financial', FULL)
export class FinanceSettingsController {
  constructor(private readonly treasury: TreasuryService) {}

  @Post('categories')
  createCategory(@Body() body: CategoryDto) {
    return this.treasury.saveCategory(null, { ...body, parentId: body.parentId ?? null, active: body.active ?? true });
  }

  @Patch('categories/:id')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() body: CategoryDto) {
    return this.treasury.saveCategory(id, { ...body, parentId: body.parentId ?? null, active: body.active ?? true });
  }

  @Post('accounts')
  createAccount(@Body() body: AccountDto) {
    return this.treasury.saveAccount(null, toAccount(body));
  }

  @Patch('accounts/:id')
  updateAccount(@Param('id', ParseUUIDPipe) id: string, @Body() body: AccountDto) {
    return this.treasury.saveAccount(id, toAccount(body));
  }

  @Post('payment-methods')
  createPaymentMethod(@Body() body: NamedDto) {
    return this.treasury.saveNamed('paymentMethod', null, { name: body.name, active: body.active ?? true });
  }

  @Patch('payment-methods/:id')
  updatePaymentMethod(@Param('id', ParseUUIDPipe) id: string, @Body() body: NamedDto) {
    return this.treasury.saveNamed('paymentMethod', id, { name: body.name, active: body.active ?? true });
  }

  @Post('cost-centers')
  createCostCenter(@Body() body: NamedDto) {
    return this.treasury.saveNamed('costCenter', null, { name: body.name, active: body.active ?? true });
  }

  @Patch('cost-centers/:id')
  updateCostCenter(@Param('id', ParseUUIDPipe) id: string, @Body() body: NamedDto) {
    return this.treasury.saveNamed('costCenter', id, { name: body.name, active: body.active ?? true });
  }
}

function toAccount(body: AccountDto) {
  return {
    name: body.name,
    bank: body.bank ?? null,
    accountType: body.accountType ?? null,
    agency: body.agency ?? null,
    number: body.number ?? null,
    initialBalance: body.initialBalance ?? 0,
    isDefault: body.isDefault,
    active: body.active ?? true,
  };
}
