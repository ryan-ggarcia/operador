import { Body, Controller, Get, Put } from '@nestjs/common';
import { LoadAccess, RequireAdministrator } from '../auth/public/index.js';
import { UpdateAgencyDto } from './dto/agency.dto.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('agency')
  @LoadAccess()
  getAgency() {
    return this.settings.getAgency();
  }

  @Put('agency')
  @RequireAdministrator()
  updateAgency(@Body() body: UpdateAgencyDto) {
    return this.settings.updateAgency(body);
  }
}
