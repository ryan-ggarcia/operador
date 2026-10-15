// Ponto único de montagem dos serviços da API (injeção de dependências do
// front): os componentes usam `api.<área>` e nunca chamam fetch direto.
import { AuthService, UsersService } from './auth.service';
import { HttpClient, LocalTokenStore } from './http';
import { FinanceService } from './finance.service';
import { MediaService } from './media.service';
import { PartiesService, SettingsService } from './parties.service';
import { ProductionService } from './production.service';
import { CommentsService, JobsService, ProjectsService, StatusesService } from './projects.service';
import { TimesheetService } from './timesheet.service';

export { ApiError } from './http';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const tokens = new LocalTokenStore();
export const http = new HttpClient(API_URL, tokens);

export const api = {
  auth: new AuthService(http, tokens),
  users: new UsersService(http),
  projects: new ProjectsService(http),
  jobs: new JobsService(http),
  comments: new CommentsService(http),
  statuses: new StatusesService(http),
  parties: new PartiesService(http),
  settings: new SettingsService(http),
  timesheet: new TimesheetService(http),
  media: new MediaService(http),
  finance: new FinanceService(http),
  production: new ProductionService(http),
};
