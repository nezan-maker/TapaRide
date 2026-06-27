import { render } from "@react-email/render";
import { VerificationEmail } from "./VerificationEmail.js";
import { PhoneVerificationEmail } from "./PhoneVerificationEmail.js";

export async function renderVerificationEmail(verificationLink: string): Promise<string> {
  return render(VerificationEmail({ verificationLink }));
}

export async function renderPhoneVerificationEmail(): Promise<string> {
  return render(PhoneVerificationEmail({}));
}