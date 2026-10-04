/**
 * Generates the scrypt hash stored for the admin portal login
 * (admin.kopanalys.se) - the password itself is never written anywhere.
 *
 * Interactive (hidden prompt):   npm run admin:hash
 * From stdin (no TTY needed):    printf '%s' "$PASSWORD" | npm run admin:hash --silent
 *
 * Prints the hash on stdout (everything else goes to stderr). To rotate the
 * password, set the printed value as ADMIN_PASSWORD_HASH in the deployment's
 * environment; it takes precedence over the hash built into the code and
 * signs every existing admin session out.
 */
import { hashPassword } from "../src/lib/admin/password";

const MIN_RECOMMENDED_LENGTH = 12;

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stderr.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stderr.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          process.stderr.write("\n");
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) return (await readStdin()).replace(/\r?\n$/, "");
  const first = await promptHidden("New admin password: ");
  const second = await promptHidden("Repeat password:     ");
  if (first !== second) throw new Error("The two passwords do not match.");
  return first;
}

async function main() {
  const password = await readPassword();
  if (!password) throw new Error("The password must not be empty.");
  if (password.length < MIN_RECOMMENDED_LENGTH) {
    console.error(
      `Warning: this password is shorter than ${MIN_RECOMMENDED_LENGTH} characters. A hash cannot make a weak password strong - anyone who can read the hash can guess it offline.`
    );
  }
  console.log(await hashPassword(password));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
