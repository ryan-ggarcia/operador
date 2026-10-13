import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Libera a rota do JWT (ex.: login, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
