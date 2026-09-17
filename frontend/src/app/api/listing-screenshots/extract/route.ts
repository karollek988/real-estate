import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { extractFromScreenshotText } from "@/lib/analysis/listing/screenshotExtract";
import { pythonEngineHeaders } from "@/lib/pythonEngine";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB per image
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const RATE_LIMIT_PER_HOUR = 30;

export const maxDuration = 60;

/**
 * POST /api/listing-screenshots/extract — OCRs 1-6 uploaded listing
 * screenshots and returns best-effort extracted property fields for the
 * user to review in the manual-entry form.
 *
 * Nothing is persisted: images are validated and base64-relayed to the
 * Python engine's OCR endpoint entirely in memory, and discarded once this
 * request completes — there is no storage bucket and no temp file for this
 * feature, so there is nothing to clean up afterwards.
 */
export async function POST(request: Request) {
  const { response: authError } = await requireUser();
  if (authError) return authError;

  if (!checkRateLimit(`listing-screenshots:${clientIp(request)}`, RATE_LIMIT_PER_HOUR, 60 * 60_000)) {
    return errorResponse(
      429,
      "rate_limited",
      "För många uppladdningar från din uppkoppling – försök igen om en stund."
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "invalid_request", "Request must be multipart/form-data.");
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return errorResponse(400, "invalid_request", "Ladda upp minst en skärmdump.");
  }
  if (files.length > MAX_IMAGES) {
    return errorResponse(422, "too_many_files", `Max ${MAX_IMAGES} bilder åt gången.`);
  }
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return errorResponse(422, "invalid_file_type", "Endast PNG-, JPEG- eller WEBP-bilder stöds.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return errorResponse(413, "file_too_large", "Varje bild får vara max 8 MB.");
    }
  }

  const apiBase = process.env.PYTHON_ENGINE_API_URL;
  if (!apiBase) {
    return errorResponse(
      503,
      "not_connected",
      "Bildläsning är inte tillgänglig just nu — fyll i uppgifterna manuellt istället."
    );
  }

  const imagesBase64 = await Promise.all(
    files.map(async (file) => Buffer.from(await file.arrayBuffer()).toString("base64"))
  );

  let texts: string[];
  try {
    const ocrRes = await fetch(`${apiBase.replace(/\/$/, "")}/api/ocr/extract-text`, {
      method: "POST",
      headers: pythonEngineHeaders(),
      body: JSON.stringify({ images_base64: imagesBase64 }),
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });
    const body = await ocrRes.json().catch(() => null);
    if (!ocrRes.ok || !body?.success) {
      return errorResponse(
        502,
        "ocr_failed",
        "Kunde inte läsa bilderna just nu. Försök igen eller fyll i uppgifterna manuellt."
      );
    }
    texts = body.texts as string[];
  } catch {
    return errorResponse(
      502,
      "ocr_failed",
      "Kunde inte läsa bilderna just nu. Försök igen eller fyll i uppgifterna manuellt."
    );
  }

  if (texts.every((t) => !t || t.trim().length === 0)) {
    return errorResponse(
      422,
      "no_text_found",
      "Kunde inte hitta någon text i bilderna. Prova en tydligare skärmdump eller fyll i uppgifterna manuellt."
    );
  }

  const { fields, foundKeys } = extractFromScreenshotText(texts);
  return NextResponse.json({ fields, foundKeys });
}
