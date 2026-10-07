/**
 * Checks the translations against the Swedish master copy:  npm run i18n:check
 *
 * For every language on the list in src/i18n/locales.ts (except Swedish) it reports
 *   - texts that are missing (they are shown in Swedish until they are translated),
 *   - texts that Swedish does not have (a leftover, or a typo in a key),
 *   - texts that are not valid message syntax (a stray { or an unclosed <tag>),
 *   - texts whose {placeholders} or <tags> differ from the Swedish text's (the page would show a gap or fail).
 * A language with missing texts is fine to publish - the site falls back to Swedish for them - so missing texts
 * only make the check say so; the other three kinds of problem make it fail (exit code 1).
 *
 *   npm run i18n:check            all languages
 *   npm run i18n:check -- en      one language
 */
import { TYPE, parse, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { LOCALE_CODES, DEFAULT_LOCALE } from "../src/i18n/locales";
import { loadOwnMessages } from "../src/i18n/messages";
import swedish from "../src/i18n/messages/sv";

type Flat = Map<string, string>;

/** Every text, by its full key: "landing.hero.title" -> "...". */
function flatten(value: unknown, prefix: string, out: Flat): Flat {
  if (typeof value === "string") out.set(prefix, value);
  else if (Array.isArray(value)) value.forEach((item, index) => flatten(item, `${prefix}.${index}`, out));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) flatten(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

/** The names a message uses: {values}, and <tags>. */
function usedNames(ast: MessageFormatElement[], names: Set<string>) {
  for (const element of ast) {
    switch (element.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        names.add(element.value);
        break;
      case TYPE.select:
      case TYPE.plural:
        names.add(element.value);
        for (const option of Object.values(element.options)) usedNames(option.value, names);
        break;
      case TYPE.tag:
        names.add(`<${element.value}>`);
        usedNames(element.children, names);
        break;
      default:
        break;
    }
  }
}

function namesOf(message: string): { names: Set<string> } | { error: string } {
  try {
    const names = new Set<string>();
    usedNames(parse(message, { ignoreTag: false }), names);
    return { names };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const master = flatten(swedish, "", new Map());
  const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const codes = LOCALE_CODES.filter((code) => code !== DEFAULT_LOCALE && (wanted.length === 0 || wanted.includes(code)));

  let failed = false;

  // The Swedish texts themselves must be valid, or nothing else means anything.
  for (const [key, text] of master) {
    const parsed = namesOf(text);
    if ("error" in parsed) {
      console.log(`sv   ${key}: not valid message syntax (${parsed.error})`);
      failed = true;
    }
  }

  for (const code of codes) {
    const own = flatten(await loadOwnMessages(code), "", new Map());
    const missing = [...master.keys()].filter((key) => !own.has(key));
    const extra = [...own.keys()].filter((key) => !master.has(key));
    const broken: string[] = [];
    for (const [key, text] of own) {
      const reference = master.get(key);
      if (reference === undefined) continue;
      const parsed = namesOf(text);
      if ("error" in parsed) {
        broken.push(`${key}: not valid message syntax (${parsed.error})`);
        continue;
      }
      const expected = namesOf(reference);
      if ("error" in expected) continue;
      const lacking = [...expected.names].filter((name) => !parsed.names.has(name));
      const surplus = [...parsed.names].filter((name) => !expected.names.has(name));
      if (lacking.length > 0) broken.push(`${key}: leaves out ${lacking.join(", ")}`);
      if (surplus.length > 0) broken.push(`${key}: uses ${surplus.join(", ")}, which the Swedish text does not`);
    }

    const done = master.size - missing.length;
    console.log(`\n${code}: ${done} of ${master.size} texts translated (${Math.round((done / master.size) * 100)} %)`);
    if (missing.length > 0) {
      const byArea = new Map<string, number>();
      for (const key of missing) byArea.set(key.split(".")[0], (byArea.get(key.split(".")[0]) ?? 0) + 1);
      console.log(`  missing (shown in Swedish): ${[...byArea].map(([area, count]) => `${area} ${count}`).join(", ")}`);
      if (wanted.length > 0) for (const key of missing) console.log(`    ${key}`);
    }
    for (const key of extra) console.log(`  extra, not in Swedish: ${key}`);
    for (const line of broken) console.log(`  problem: ${line}`);
    if (extra.length > 0 || broken.length > 0) failed = true;
  }

  console.log(failed ? "\nFound problems that need fixing." : "\nNo problems found.");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
