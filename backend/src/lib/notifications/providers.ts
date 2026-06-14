import { env } from '../../config/env.js';
import { ExternalProviderError } from '../errors.js';
import { logger } from '../logger.js';

type WebhookPayload = Record<string, unknown>;

async function postWebhook(
  url: string,
  token: string | undefined,
  payload: WebhookPayload,
) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new ExternalProviderError('Provider request failed', {
        status: response.status,
        url,
      });
    }
  } catch (error) {
    if (error instanceof ExternalProviderError) {
      throw error;
    }

    throw new ExternalProviderError('Provider request failed', {
      reason: error instanceof Error ? error.message : 'unknown_error',
      url,
    });
  }
}

export async function deliverEmail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  if (env.EMAIL_PROVIDER === 'console') {
    logger.info({ to: options.to, subject: options.subject }, 'Console email delivery');
    return;
  }

  if (env.EMAIL_PROVIDER === 'brevo') {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'TapaRide', email: env.MAIL_FROM },
        to: [{ email: options.to }],
        subject: options.subject,
        htmlContent: options.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ExternalProviderError('Brevo email API request failed', {
        status: response.status,
        body: body.slice(0, 500),
        to: options.to,
        subject: options.subject,
      });
    }

    logger.info({ to: options.to, subject: options.subject }, 'Brevo email sent');
    return;
  }

  await postWebhook(env.EMAIL_PROVIDER_URL!, env.EMAIL_PROVIDER_TOKEN, {
    from: env.MAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

export async function deliverSms(options: {
  phone: string;
  message: string;
}) {
  if (env.SMS_PROVIDER === 'console') {
    logger.info({ phone: options.phone }, 'Console SMS delivery');
    return;
  }

  await postWebhook(env.SMS_PROVIDER_URL!, env.SMS_PROVIDER_TOKEN, {
    to: options.phone,
    message: options.message,
  });
}
