import { z } from 'zod';

export const setupWalletSchema = z.object({
  walletPassword: z.string().min(4, 'Wallet password/PIN must be at least 4 characters'),
});

export const depositSchema = z.object({
  amount: z.number().int().positive('Amount must be a positive integer (smallest currency unit)'),
  walletPassword: z.string().optional(),
});

export const withdrawSchema = z.object({
  amount: z.number().int().positive('Amount must be a positive integer (smallest currency unit)'),
  walletPassword: z.string().optional(),
});

export const walletPasswordSchema = z.object({
  walletPassword: z.string().optional(),
});

export const unlockWalletSchema = z.object({
  walletPassword: z.string().min(1, 'Wallet password is required to unlock your wallet'),
});

export const changeWalletPasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current wallet password is required'),
  newPassword: z
    .string()
    .min(4, 'New wallet password/PIN must be at least 4 characters'),
});

export type SetupWalletDto = z.infer<typeof setupWalletSchema>;
export type DepositDto = z.infer<typeof depositSchema>;
export type WithdrawDto = z.infer<typeof withdrawSchema>;
export type UnlockWalletDto = z.infer<typeof unlockWalletSchema>;
export type ChangeWalletPasswordDto = z.infer<typeof changeWalletPasswordSchema>;
