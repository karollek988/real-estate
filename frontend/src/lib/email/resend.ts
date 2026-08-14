import { Resend } from "resend";

let resendClient: Resend | null = null;

export function createResendClient(): Resend {
  if (typeof window !== "undefined") {
    throw new Error("createResendClient must only be called on the server");
  }

  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("Missing RESEND_API_KEY environment variable");
    }
    resendClient = new Resend(key);
  }

  return resendClient;
}

export function getEmailFrom(): string {
  return process.env.RESEND_FROM_EMAIL ?? "Köpanalys <info@kopanalys.se>";
}
