import { env } from '../config/env.js';
import { getNotificationsQueue } from './notifications/queue.js';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html: _html }: MailOptions): Promise<void> {
  await getNotificationsQueue().add('email', {
    kind: 'email',
    to,
    subject,
    html: _html,
  });
}

/** Sends an email verification link. */
export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${env.EMAIL_VERIFICATION_ORIGIN}/auth/verify-email?token=${token}`;
  await sendMail({
    to,
    subject: 'Verify your Tapa account',
    html: `
      <h2>Welcome to Tapa 🚌</h2>
      <p>Click the link below to verify your email address:</p>
      <a href="${link}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">
        Verify Email
      </a>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  await getNotificationsQueue().add('sms:otp', {
    kind: 'sms',
    phone,
    message: `Your Tapa verification code is ${otp}. It expires in ${env.OTP_EXPIRES_MINUTES} minutes.`,
  });
}

/** Sends a Safe Arrival boarding notification. */
export async function sendBoardingNotification(to: { phone?: string; email?: string }, studentName: string): Promise<void> {
  const subject = `Safe Boarding: ${studentName}`;
  const message = `${studentName} has successfully boarded the vehicle. We will notify you upon arrival.`;

  if (to.email) {
    await sendMail({ to: to.email, subject, html: `<p>${message}</p>` });
  }
  if (to.phone) {
    await getNotificationsQueue().add('sms:boarding', {
      kind: 'sms',
      phone: to.phone,
      message,
    });
  }
}

/** Sends a Safe Arrival alighting notification. */
export async function sendAlightingNotification(to: { phone?: string; email?: string }, studentName: string): Promise<void> {
  const subject = `Safe Arrival: ${studentName}`;
  const message = `${studentName} has safely alighted at their stop.`;

  if (to.email) {
    await sendMail({ to: to.email, subject, html: `<p>${message}</p>` });
  }
  if (to.phone) {
    await getNotificationsQueue().add('sms:alighting', {
      kind: 'sms',
      phone: to.phone,
      message,
    });
  }
}
