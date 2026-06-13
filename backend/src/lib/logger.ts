import pino, { type LoggerOptions } from 'pino';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'crypto';
import { Writable } from 'stream';
import type { Request, Response } from 'express';

import { env } from '../config/env.js';

function color(code: number, value: string) {
  return `\u001b[${code}m${value}\u001b[0m`;
}

function levelColor(level: string) {
  switch (level) {
    case 'ERROR':
      return 31;
    case 'WARN':
      return 33;
    case 'INFO':
      return 36;
    case 'DEBUG':
      return 90;
    default:
      return 37;
  }
}

function statusColor(statusCode?: number) {
  if (!statusCode) return 37;
  if (statusCode >= 500) return 31;
  if (statusCode >= 400) return 33;
  if (statusCode >= 300) return 36;
  if (statusCode >= 200) return 32;
  return 37;
}

function formatTimestamp(epochMs?: number) {
  if (!epochMs) return '';
  return new Date(epochMs).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function trimUserAgent(userAgent?: string) {
  if (!userAgent) return undefined;
  if (userAgent.includes(' Chrome/')) return 'Chrome';
  if (userAgent.includes('Safari/') && userAgent.includes('Mobile/')) return 'Mobile Safari';
  if (userAgent.includes('Safari/')) return 'Safari';
  if (userAgent.includes('Firefox/')) return 'Firefox';
  return userAgent.length > 48 ? `${userAgent.slice(0, 45)}...` : userAgent;
}

function formatReq(entry: Record<string, any>) {
  const req = entry.req;
  if (!req) return '';

  const parts = [
    req.method,
    req.url,
    req.id ? `req=${req.id}` : undefined,
    req.remoteAddress ? `ip=${req.remoteAddress}` : undefined,
    trimUserAgent(req.headers?.['user-agent'])
      ? `ua=${trimUserAgent(req.headers?.['user-agent'])}`
      : undefined,
  ].filter(Boolean);

  return parts.join(' ');
}

function formatError(entry: Record<string, any>) {
  const err = entry.err;
  if (!err) return '';

  const bits = [
    err.code ?? entry.code,
    err.statusCode ?? entry.statusCode,
    err.message,
  ].filter(Boolean);

  return bits.join(' ');
}

function formatDevLog(entry: Record<string, any>) {
  const time = color(90, formatTimestamp(entry.time));
  const levelLabel = (entry.levelLabel ?? 'INFO').toUpperCase();
  const level = color(levelColor(levelLabel), levelLabel.padEnd(5));

  if (entry.component === 'prisma') {
    const duration =
      typeof entry.durationMs === 'number'
        ? color(90, `${entry.durationMs}ms`)
        : '';
    const query = typeof entry.query === 'string' ? entry.query : entry.msg ?? 'Prisma event';
    const params =
      typeof entry.params === 'string' && entry.params.length > 0
        ? color(90, `params=${entry.params}`)
        : '';
    return `${time} ${level} ${color(35, 'PRISMA')} ${query} ${duration} ${params}`.trim();
  }

  if (entry.msg === 'request completed' && entry.req) {
    const statusCode = entry.res?.statusCode;
    const status = color(statusColor(statusCode), String(statusCode ?? '---'));
    const duration =
      typeof entry.responseTime === 'number'
        ? color(90, `${Math.round(entry.responseTime)}ms`)
        : '';
    return `${time} ${level} ${status} ${formatReq(entry)} ${duration}`.trim();
  }

  if (entry.msg === 'Request failed') {
    const statusCode = entry.statusCode ?? entry.err?.statusCode;
    const status = color(statusColor(statusCode), String(statusCode ?? 'ERR'));
    return `${time} ${level} ${status} ${formatReq(entry)} ${formatError(entry)}`.trim();
  }

  if (entry.req) {
    return `${time} ${level} ${formatReq(entry)} ${entry.msg ?? ''}`.trim();
  }

  return `${time} ${level} ${entry.msg ?? ''}`.trim();
}

function createDevStream() {
  return new Writable({
    write(chunk, _encoding, callback) {
      try {
        const entry = JSON.parse(chunk.toString()) as Record<string, any>;
        process.stdout.write(`${formatDevLog(entry)}\n`);
      } catch {
        process.stdout.write(chunk.toString());
      }
      callback();
    },
  });
}

const loggerOptions: LoggerOptions = {
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  base: env.NODE_ENV === 'development' ? undefined : undefined,
  formatters: {
    level(label) {
      return { level: label, levelLabel: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.epochTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.walletPassword',
      'req.body.refreshToken',
      'req.body.code',
      'res.body.accessToken',
      'res.body.refreshToken',
    ],
    censor: '[REDACTED]',
  },
};

export const logger =
  env.NODE_ENV === 'development'
    ? pino(loggerOptions, createDevStream())
    : pino(loggerOptions);

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: Request, res: Response) => {
    const existing = req.headers['x-request-id'];
    const requestId =
      typeof existing === 'string' && existing.length > 0
        ? existing
        : randomUUID();
    res.setHeader('x-request-id', requestId);
    return requestId;
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} completed with ${res.statusCode}`,
  customErrorMessage: (req, res, error) =>
    `${req.method} ${req.url} failed with ${res.statusCode} ${error.message}`,
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
        headers: {
          'user-agent': req.headers['user-agent'],
          host: req.headers.host,
        },
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
    err(error) {
      return {
        type: error.name,
        message: error.message,
        code: (error as Error & { code?: string }).code,
        statusCode: (error as Error & { statusCode?: number }).statusCode,
        stack: error.stack,
      };
    },
  },
});
