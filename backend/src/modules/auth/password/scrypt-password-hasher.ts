import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from './password-hasher.js';

const KEY_LENGTH = 64;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function derive(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: cost, r: blockSize, p: parallelization, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}

/**
 * Hash de senha com scrypt (nativo do Node, sem dependência externa).
 * Formato gravado: scrypt$N$r$p$salt$hash (salt e hash em base64).
 */
@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELIZATION);
    return [
      'scrypt',
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString('base64'),
      key.toString('base64'),
    ].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, cost, blockSize, parallelization, salt, hash] =
      stored.split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const expected = Buffer.from(hash, 'base64');
    const actual = await derive(
      password,
      Buffer.from(salt, 'base64'),
      Number(cost),
      Number(blockSize),
      Number(parallelization),
    );
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }
}
