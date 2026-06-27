import { render } from "@react-email/render";
import { VerificationEmail } from "./VerificationEmail.js";

export async function renderVerificationEmail(verificationLink: string): Promise<string> {
  return render(VerificationEmail({ verificationLink }));
}