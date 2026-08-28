/**
 * Creates an admin account.
 *
 * Run by a person, not by CI and not by a migration:
 *
 *   corepack yarn nx run fitoverforty-backend:create-admin
 *
 * Why this is a script and not a seed migration. The password hash has to be
 * one that Better Auth's sign-in will later verify, which means it has to be
 * produced by Better Auth's own hasher with its own parameters. A hash
 * committed to a migration would pin those parameters forever, and it would
 * put a credential — even a placeholder one — into version control, where the
 * placeholder invariably survives into production.
 *
 * The password is read from a hidden prompt rather than an argument or an
 * environment variable, so it does not reach shell history, `ps` output, or CI
 * logs.
 *
 * The nx target registers `tsconfig-paths` explicitly. This script pulls in the
 * data source, which reaches blog content code importing
 * `@fitoverforty/blog-ts` as a value; without that registration it fails
 * with MODULE_NOT_FOUND on the alias rather than anything about admin accounts.
 */
import { config } from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { makeRuntimeDataSource } from '../src/data-source';
import { createAuth } from '@fitoverforty/auth-nest';

config({ path: resolve(__dirname, '../../../../.env') });

const ETX = '\u0003'; // Ctrl-C
const EOT = '\u0004'; // Ctrl-D
const DEL = '\u007f'; // Backspace, as most terminals send it

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/**
 * Reads a line without echoing it.
 *
 * `readline` has no hidden-input mode, so this drops to raw mode and consumes
 * keystrokes directly. Ctrl-C has to be handled by hand: in raw mode the
 * terminal no longer turns it into SIGINT, so without that branch the script
 * would be unquittable at exactly the prompt people most want to escape.
 */
function askHidden(question: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);

    const wasRaw = stdin.isRaw ?? false;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';

    const finish = (outcome: () => void) => {
      stdin.setRawMode?.(wasRaw);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
      outcome();
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\n' || char === '\r') {
          finish(() => resolvePromise(value));
          return;
        }
        if (char === ETX || char === EOT) {
          finish(() => reject(new Error('Cancelled.')));
          return;
        }
        if (char === DEL || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  const email = await ask('Email: ');
  const name = await ask('Name: ');
  const password = await askHidden('Password (min 12 characters): ');
  const confirmation = await askHidden('Confirm password: ');

  if (password !== confirmation) throw new Error('Passwords do not match.');
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters.');
  }
  if (!email.includes('@')) throw new Error(`Not an email address: ${email}`);
  if (name.length === 0) throw new Error('Name is required.');

  const dataSource = makeRuntimeDataSource();
  await dataSource.initialize();

  try {
    const auth = createAuth(dataSource, { allowSignUp: true });
    await auth.api.signUpEmail({ body: { email, name, password } });
    process.stdout.write(`Created admin account for ${email}.\n`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
