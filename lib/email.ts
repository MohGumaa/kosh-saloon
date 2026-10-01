import { Resend } from "resend";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends through Resend. Without EMAIL_API_KEY, development prints the message
 * to the server console; production throws so the caller can log the failure.
 */
export async function sendEmail({ to, subject, text, html }: EmailMessage): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:dev] To: ${to}\nSubject: ${subject}\n\n${text}`);
      return;
    }
    throw new Error("Email is not configured: set EMAIL_API_KEY and EMAIL_FROM.");
  }

  const { error } = await new Resend(apiKey).emails.send({ from, to, subject, text, html });
  if (error) throw new Error(`Resend rejected the email: ${error.name}: ${error.message}`);
}

/** Absolute URL for links in emails. */
export function appUrl(path: string): string {
  const base = process.env.APP_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!base) throw new Error("APP_URL is not set; cannot build email links.");
  return new URL(path, base).toString();
}
