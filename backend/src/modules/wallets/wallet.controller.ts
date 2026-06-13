import { Request, Response, NextFunction } from 'express';
import { requireIdempotencyKey, runIdempotentMutation } from '../../lib/idempotency.js';
import { paginationSchema } from '../../lib/pagination.js';
import {
  setupWalletSchema,
  depositSchema,
  withdrawSchema,
  walletPasswordSchema,
  unlockWalletSchema,
  changeWalletPasswordSchema,
} from './wallet.schema.js';
import * as WalletService from './wallet.service.js';

export async function setupWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = setupWalletSchema.parse(req.body);
    const result = await runIdempotentMutation({
      userId: user.id,
      route: 'wallet.setup',
      idempotencyKey: requireIdempotencyKey(req),
      requestBody: dto,
      execute: async () => ({
        statusCode: 201,
        body: await WalletService.setupWallet(user.id, dto),
      }),
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
}

export async function unlockWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = unlockWalletSchema.parse(req.body);
    const result = await WalletService.unlockWallet(user.id, dto);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const { walletPassword } = walletPasswordSchema.parse(req.body);
    const balance = await WalletService.getBalance(user.id, walletPassword);
    res.json({ balance });
  } catch (error) {
    next(error);
  }
}

export async function deposit(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = depositSchema.parse(req.body);
    const result = await runIdempotentMutation({
      userId: user.id,
      route: 'wallet.deposit',
      idempotencyKey: requireIdempotencyKey(req),
      requestBody: dto,
      execute: async () => ({
        statusCode: 200,
        body: await WalletService.deposit(user.id, dto),
      }),
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
}

export async function withdraw(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = withdrawSchema.parse(req.body);
    const result = await runIdempotentMutation({
      userId: user.id,
      route: 'wallet.withdraw',
      idempotencyKey: requireIdempotencyKey(req),
      requestBody: dto,
      execute: async () => ({
        statusCode: 200,
        body: await WalletService.withdraw(user.id, dto),
      }),
    });
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    next(error);
  }
}

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const pagination = paginationSchema.parse(req.query);
    const result = await WalletService.getTransactions(user.id, pagination);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const dto = changeWalletPasswordSchema.parse(req.body);
    const result = await WalletService.changeWalletPassword(user.id, dto.oldPassword, dto.newPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getWalletStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as { id: string };
    const result = await WalletService.getWalletStatus(user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
