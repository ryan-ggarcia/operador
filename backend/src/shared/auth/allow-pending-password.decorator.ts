import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_KEY = 'allowPendingPassword';

/** Libera a rota para quem ainda precisa trocar a senha provisória. */
export const AllowPendingPassword = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_KEY, true);
