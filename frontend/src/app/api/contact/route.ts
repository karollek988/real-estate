import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactBody {
  name?: string;
  email?: string;
  message?: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          code: "contact_unavailable",
          message:
            "Kontakt via formulär är inte tillgänglig just nu — mejla oss direkt på kopanalys@gmail.com istället.",
        },
      },
      { status: 503 },
    );
  }

  let body: ContactBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const { name, email, message } = body;

  const errors: string[] = [];
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    errors.push("name is required");
  }
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    errors.push("a valid email is required");
  }
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    errors.push("message is required");
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: { code: "validation_error", message: errors.join("; ") } },
      { status: 400 },
    );
  }

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "kopanalys@gmail.com",
      replyTo: email!,
      subject: `Nytt meddelande från kopanalys.se — ${name!.trim()}`,
      text: `Namn: ${name!.trim()}\nE-post: ${email!.trim()}\n\nMeddelande:\n${message!.trim()}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Resend API error:", err);
    return NextResponse.json(
      {
        error: {
          code: "contact_unavailable",
          message:
            "Kontakt via formulär är inte tillgänglig just nu — mejla oss direkt på kopanalys@gmail.com istället.",
        },
      },
      { status: 503 },
    );
  }
}
