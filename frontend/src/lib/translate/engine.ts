import { pythonEngineHeaders } from "@/lib/pythonEngine";

/**
 * The translator: POST /api/translate on the Python engine (api/translation.py), an offline open-source model.
 * Server-only. Anything that goes wrong (the engine is down, the model is not installed, a timeout) is an
 * answer of `null`, never an exception: the pages then show the Swedish text and try again on their next rebuild.
 */

export interface EngineAnswer {
  translations: string[];
  /** The translator's version (model and glossary): stored with each translation. */
  engine: string;
}

const REQUEST_TIMEOUT_MS = 120_000;

let lastWarning = 0;

function warn(message: string) {
  // one line a minute at most: a down engine would otherwise fill the log with one line per paragraph
  if (Date.now() - lastWarning < 60_000) return;
  lastWarning = Date.now();
  console.warn(`[translate] ${message}`);
}

export function engineConfigured(): boolean {
  return Boolean(process.env.PYTHON_ENGINE_API_URL);
}

export async function callEngine(texts: string[], source: string, target: string): Promise<EngineAnswer | null> {
  const base = process.env.PYTHON_ENGINE_API_URL;
  if (!base) {
    warn("PYTHON_ENGINE_API_URL is not set: content is shown in Swedish.");
    return null;
  }
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/api/translate`, {
      method: "POST",
      headers: pythonEngineHeaders(),
      body: JSON.stringify({ texts, source, target }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { success?: boolean; translations?: unknown; engine?: unknown; error?: string } | null;
    if (!response.ok || !body?.success || !Array.isArray(body.translations) || body.translations.length !== texts.length) {
      warn(`The translator answered ${response.status}${body?.error ? `: ${body.error}` : ""}.`);
      return null;
    }
    return { translations: body.translations.map(String), engine: typeof body.engine === "string" ? body.engine : "unknown" };
  } catch (err) {
    warn(`The translator could not be reached (${err instanceof Error ? err.name : "error"}).`);
    return null;
  }
}
