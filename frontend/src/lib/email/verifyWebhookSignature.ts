import { createHmac, timingSafeEqual } from "crypto";

const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;

// Standard Webhooks verification (used by Supabase Auth Hooks) — hand-rolled
// instead of pulling in the `standardwebhooks` package: the algorithm is
// short and this repo prefers the smallest tool that does the job. Secret is
// provided as "v1,whsec_<base64>" (or just "whsec_<base64>"); signed content
// is "{webhook-id}.{webhook-timestamp}.{raw body}", HMAC-SHA256, base64.
function decodeSecret(secret: string): Buffer {
  const withoutVersion = secret.startsWith("v1,") ? secret.slice(3) : secret;
  const withoutPrefix = withoutVersion.startsWith("whsec_") ? withoutVersion.slice(6) : withoutVersion;
  return Buffer.from(withoutPrefix, "base64");
}

export function verifyStandardWebhookSignature(params: {
  payload: string;
  headers: { id: string | null; timestamp: string | null; signature: string | null };
  secret: string;
}): boolean {
  const { payload, headers, secret } = params;
  if (!headers.id || !headers.timestamp || !headers.signature) return false;

  const timestampSeconds = Number(headers.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_SIGNATURE_AGE_SECONDS) return false;

  const signedContent = `${headers.id}.${headers.timestamp}.${payload}`;
  const expected = createHmac("sha256", decodeSecret(secret)).update(signedContent).digest();

  for (const candidate of headers.signature.split(" ")) {
    const [version, sig] = candidate.split(",");
    if (version !== "v1" || !sig) continue;

    let provided: Buffer;
    try {
      provided = Buffer.from(sig, "base64");
    } catch {
      continue;
    }

    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return true;
    }
  }

  return false;
}
