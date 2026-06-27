import { env } from "../config/env.js";
import { getNotificationsQueue } from "./notifications/queue.js";
import { renderVerificationEmail, renderPhoneVerificationEmail } from "../emails/render.js";

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: MailOptions): Promise<void> {
  await getNotificationsQueue().add("email", {
    kind: "email",
    to,
    subject,
    html,
  });
}

/** Sends a professional email verification link. */
export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${env.EMAIL_VERIFICATION_ORIGIN}/api/auth/verify-email?token=${token}`;
  const html = await renderVerificationEmail(link);

  await sendMail({
    to,
    subject: "Verify your TapaRide account",
    html,
  });
}

/** Sends phone verification notification email. */
export async function sendPhoneVerificationEmail(to: string): Promise<void> {
  const html = await renderPhoneVerificationEmail();

  await sendMail({
    to,
    subject: "Verify your phone number on TapaRide",
    html,
  });
}

export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  await getNotificationsQueue().add("sms:otp", {
    kind: "sms",
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
    await getNotificationsQueue().add("sms:boarding", {
      kind: "sms",
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
    await getNotificationsQueue().add("sms:alighting", {
      kind: "sms",
      phone: to.phone,
      message,
    });
  }
}