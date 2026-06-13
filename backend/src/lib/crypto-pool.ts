// src/lib/crypto-pool.ts
// ---------------------------------------------------------------
//  Crypto Worker Pool – production‑grade off‑loading of CPU heavy crypto
// ---------------------------------------------------------------
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// The worker must be a .js file (worker_threads requirement).
// When running via tsx watch, __dirname points to src/lib → fall back to project-root/dist/lib.
let WORKER_PATH = path.resolve(__dirname, 'crypto.worker.js');
if (!existsSync(WORKER_PATH)) {
  // Go up from src/lib to project root, then into dist/lib
  WORKER_PATH = path.resolve(__dirname, '..', '..', 'dist', 'lib', 'crypto.worker.js');
}

type TaskType =
  | 'ARGON2_HASH'
  | 'ARGON2_COMPARE'
  | 'ENCRYPT_BALANCE'
  | 'DECRYPT_BALANCE'
  | 'PBKDF2_DERIVE';

interface Task<T = any> {
  id: string;
  type: TaskType;
  payload: any;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

class CryptoWorkerPool {
  private workers: { worker: Worker; busy: boolean }[] = [];
  private queue: Task[] = [];
  private pending = new Map<
    string,
    {
      worker: Worker;
      resolve: (v: any) => void;
      reject: (e: any) => void;
    }
  >();
  private readonly maxWorkers: number;
  private shuttingDown = false;

  constructor() {
    const envLimit = process.env['CRYPTO_WORKER_LIMIT'];
    this.maxWorkers = envLimit ? parseInt(envLimit, 10) : Math.max(1, os.cpus().length - 1);
    this.init();
  }

  private spawnWorker(): Worker {
    const w = new Worker(WORKER_PATH);
    w.on('message', this.handleMessage.bind(this));
    w.on('error', (err) => {
      logger.error({ component: 'crypto:worker', err, threadId: w.threadId }, 'Worker error');
      for (const [id, task] of this.pending.entries()) {
        if (task.worker === w) {
          task.reject(err);
          this.pending.delete(id);
        }
      }
    });
    w.on('exit', (code) => {
      this.workers = this.workers.filter((x) => x.worker !== w);
      if (this.shuttingDown) return;

      logger.warn(
        { component: 'crypto:worker', threadId: w.threadId, code },
        'Worker exited – respawning',
      );
      for (const [id, task] of this.pending.entries()) {
        if (task.worker === w) {
          task.reject(new Error(`Crypto worker exited with code ${code}`));
          this.pending.delete(id);
        }
      }
      // Remove dead worker and replace
      this.workers.push({ worker: this.spawnWorker(), busy: false });
      this.dispatch();
    });
    return w;
  }

  private init() {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push({ worker: this.spawnWorker(), busy: false });
    }
  }

  private handleMessage(msg: { id: string; result?: any; error?: string }) {
    const { id, result, error } = msg;
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    const workerState = this.workers.find((w) => w.worker === pending.worker);
    if (workerState) workerState.busy = false;
    if (error) pending.reject(new Error(error));
    else pending.resolve(result);
    this.dispatch();
  }

  public run<T>(type: TaskType, payload: any): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: Task<T> = {
        id: randomUUID(),
        type,
        payload,
        resolve,
        reject,
      };
      this.queue.push(task);
      this.dispatch();
    });
  }

  private dispatch() {
    while (this.queue.length) {
      const free = this.workers.find((w) => !w.busy);
      if (!free) break;
      const task = this.queue.shift()!;
      free.busy = true;
      this.pending.set(task.id, {
        worker: free.worker,
        resolve: task.resolve,
        reject: task.reject,
      });
      free.worker.postMessage({ id: task.id, type: task.type, payload: task.payload });
    }
  }

  public async shutdown(): Promise<void> {
    logger.info({ component: 'crypto:pool' }, 'Shutting down crypto worker pool');
    this.shuttingDown = true;
    this.queue = [];
    await Promise.all(this.workers.map((w) => w.worker.terminate()));
    this.workers = [];
    this.pending.clear();
  }
}

let pool: CryptoWorkerPool | null = null;

function getCryptoWorkerPool() {
  if (!pool) {
    pool = new CryptoWorkerPool();
  }
  return pool;
}

export async function hashPassword(password: string, rounds = 12): Promise<string> {
  return getCryptoWorkerPool().run<string>('ARGON2_HASH', { password, rounds });
}
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return getCryptoWorkerPool().run<boolean>('ARGON2_COMPARE', { password, hash });
}
export async function encryptWalletBalance(
  balance: number,
  passwordOrKey: string | Buffer,
): Promise<{ encryptedBalance: string; iv: string; authTag: string; salt: string }> {
  return getCryptoWorkerPool().run<any>('ENCRYPT_BALANCE', { balance, passwordOrKey });
}
export async function decryptWalletBalance(
  encryptedBalance: string,
  iv: string,
  authTag: string,
  salt: string,
  passwordOrKey: string | Buffer,
): Promise<number> {
  return getCryptoWorkerPool().run<number>('DECRYPT_BALANCE', {
    encryptedBalance,
    iv,
    authTag,
    salt,
    passwordOrKey,
  });
}
export async function deriveKeyPBKDF2(
  password: string,
  saltBase64: string,
  iterations = 310_000,
  keylen = 32,
  digest = 'sha512',
): Promise<string> {
  const keyBuf = await getCryptoWorkerPool().run<any>('PBKDF2_DERIVE', {
    password,
    saltBase64,
    iterations,
    keylen,
    digest,
  });
  return Buffer.from(keyBuf).toString('base64');
}

export async function shutdownCryptoPool(): Promise<void> {
  await pool?.shutdown();
  pool = null;
}
