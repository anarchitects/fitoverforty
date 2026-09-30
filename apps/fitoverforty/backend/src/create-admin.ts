// `data-source.ts` loads `.env` itself, before it reads anything from the
// environment — see the note at the top of that file. This entry point needs no
// dotenv of its own, and adding one would imply the data source could be used
// safely without it.
import { createInterface } from 'node:readline/promises';
import type { DataSource } from 'typeorm';
import { makeRuntimeDataSource } from './data-source';
import { createAuth } from '@fitoverforty/auth-nest';

/**
 * Creates an admin account.
 *
 * Two ways in, because there are two situations and they have opposite
 * requirements.
 *
 *   corepack yarn nx run fitoverforty-backend:create-admin
 *
 * On a developer machine it prompts, and the password is read without echo so
 * it reaches neither the terminal nor shell history.
 *
 *   node create-admin.js --email a@b.c --name 'A B' --password-stdin
 *
 * On a server there is no terminal to prompt at. The password is read from
 * stdin, which is the only channel that is neither an argument nor an
 * environment variable: an argument is visible in `ps` to every other user on
 * the box for as long as the process runs, and an environment variable is one
 * careless `printenv` — or one crash dump — away from a log. Stdin is a pipe
 * that closes.
 *
 * This is a bundled entry point rather than a script under `tools/` because a
 * deployed backend has no workspace: no ts-node, no tsconfig-paths, no source
 * tree. It used to live there, which meant a deployed instance could not be
 * given an administrator at all without checking the repository out on the
 * server. `migrate.ts` exists as a second entry point for exactly the same
 * reason.
 *
 * Why a script rather than a seed migration, which has not changed: the stored
 * hash has to be one Better Auth's own sign-in will later verify, so it has to
 * come from Better Auth's own hasher with its own parameters. A hash committed
 * to a migration pins those parameters for ever and puts a credential in
 * version control, where the placeholder invariably survives into production.
 *
 * `allowSignUp` is set here and nowhere else. The public registration route
 * stays closed — see `disableSignUp` in the auth factory.
 */

const MIN_PASSWORD_LENGTH = 12;

interface Args {
  readonly email?: string;
  readonly name?: string;
  readonly linkAuthor?: string;
  readonly resetPassword: boolean;
  readonly passwordFromStdin: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  let email: string | undefined;
  let name: string | undefined;
  let linkAuthor: string | undefined;
  let resetPassword = false;
  let passwordFromStdin = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--password-stdin') passwordFromStdin = true;
    else if (arg === '--reset-password') resetPassword = true;
    else if (arg === '--email') email = argv[(i += 1)];
    else if (arg === '--name') name = argv[(i += 1)];
    else if (arg.startsWith('--email=')) email = arg.slice('--email='.length);
    else if (arg.startsWith('--name=')) name = arg.slice('--name='.length);
    else if (arg === '--link-author') linkAuthor = argv[(i += 1)];
    else if (arg.startsWith('--link-author='))
      linkAuthor = arg.slice('--link-author='.length);
    else throw new Error(`Unrecognised argument: ${arg}`);
  }

  return { email, name, linkAuthor, resetPassword, passwordFromStdin };
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

const ETX = '\u0003'; // Ctrl-C
const EOT = '\u0004'; // Ctrl-D
const DEL = '\u007f'; // Backspace, as most terminals send it

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

/**
 * Reads the password from stdin.
 *
 * Exactly one trailing newline is removed, and nothing else is trimmed: a
 * password may legitimately begin or end with a space, and silently discarding
 * one would create an account whose password is not the one that was sent.
 */
async function readPasswordFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks)
    .toString('utf8')
    .replace(/\r?\n$/, '');
}

function validate(email: string, name: string, password: string): void {
  if (!email.includes('@')) throw new Error(`Not an email address: ${email}`);
  if (name.length === 0) throw new Error('Name is required.');
  if (password.length < MIN_PASSWORD_LENGTH) {
    // Stated as a length, never quoting the value.
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
}

/**
 * Attaches the new account to an author row that already exists.
 *
 * `PostAdminService.authorFor` resolves a byline by `user_id` alone, and
 * creates a row on first use when it finds none. A seeded author has
 * `user_id NULL`, so without this the first post by a new account produces a
 * *second* author — `paul-2` beside `paul` — carrying no bio and none of the
 * existing posts, while the original is left orphaned. Nothing errors, and the
 * damage is only visible once something has been published under the wrong
 * byline.
 *
 * Checked before the account is created, not after: a failure here would
 * otherwise leave an account that exists and a link that does not, which is
 * the state hardest to reason about afterwards.
 */
async function assertAuthorLinkable(
  dataSource: DataSource,
  slug: string,
): Promise<void> {
  const rows: { user_id: string | null }[] = await dataSource.query(
    `SELECT "user_id" FROM "blog"."authors" WHERE "slug" = $1`,
    [slug],
  );

  if (rows.length === 0) {
    throw new Error(
      `No author with slug "${slug}". Omit --link-author to create a new one.`,
    );
  }
  if (rows[0].user_id !== null) {
    // `uq_authors_user_id` would reject the update anyway; this says why.
    throw new Error(
      `Author "${slug}" already belongs to another account. One account ` +
        `writes as one author.`,
    );
  }
}

async function linkAuthor(
  dataSource: DataSource,
  slug: string,
  userId: string,
): Promise<void> {
  await dataSource.query(
    `UPDATE "blog"."authors" SET "user_id" = $1 WHERE "slug" = $2`,
    [userId, slug],
  );
}

/**
 * Replaces the password on an account that already exists.
 *
 * Without this an account whose password does not match whatever was intended
 * is simply lost: `signUpEmail` refuses an address it already holds, there is
 * no public reset route, and nothing in `/admin` changes a password. The only
 * remedy was a hand-written UPDATE against the database, which on a deployed
 * instance means the shell access this whole script exists to avoid needing.
 *
 * Hashed by Better Auth's own hasher through its context, for the same reason
 * sign-up is what creates an account in the first place: a hash produced any
 * other way is a hash its sign-in cannot verify.
 *
 * The new hash is verified before the function returns. It cannot prove the
 * password is the one somebody meant to set — nothing can, from in here — but
 * it does prove that what was stored is what arrived, which is the half that
 * is checkable.
 */
async function resetPassword(
  dataSource: DataSource,
  email: string,
  password: string,
): Promise<void> {
  const auth = createAuth(dataSource);
  const ctx = await auth.$context;

  const user = await ctx.internalAdapter.findUserByEmail(email);
  if (!user) throw new Error(`No account for ${email}.`);

  const hash = await ctx.password.hash(password);
  await ctx.internalAdapter.updatePassword(user.user.id, hash);

  if (!(await ctx.password.verify({ hash, password }))) {
    throw new Error(
      'The stored password did not verify. Nothing about this account can ' +
        'be trusted; do not rely on it.',
    );
  }
}

/**
 * Reports the length of the password that was actually used, and whether it
 * has whitespace at either end.
 *
 * Neither is a secret worth protecting, and between them they identify the
 * failure this script cannot otherwise distinguish from a typo: a value that
 * arrived with a stray space, or truncated, hashes perfectly happily and then
 * does not match what a person types at the sign-in form. Without this the
 * only symptom is "email address and password do not match an account", which
 * says nothing about which of the two is wrong or why.
 */
function reportLength(password: string): void {
  const edged = password !== password.trim();
  process.stdout.write(`Password used: ${password.length} characters.\n`);
  if (edged) {
    process.stdout.write(
      'Note: it begins or ends with whitespace, which was kept. If that was ' +
        'not deliberate, the password will not be what you expect.\n',
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.resetPassword && args.linkAuthor) {
    throw new Error('--reset-password does not take --link-author.');
  }
  // A reset needs no display name: the account and its author row both exist.
  if (args.passwordFromStdin && !args.email) {
    throw new Error('--password-stdin requires --email.');
  }
  if (args.passwordFromStdin && !args.resetPassword && !args.name) {
    throw new Error('--password-stdin requires --name when creating.');
  }

  const email = args.email ?? (await ask('Email: '));
  const name = args.resetPassword ? '' : (args.name ?? (await ask('Name: ')));

  let password: string;
  if (args.passwordFromStdin) {
    password = await readPasswordFromStdin();
  } else {
    password = await askHidden(
      `Password (min ${MIN_PASSWORD_LENGTH} characters): `,
    );
    if (password !== (await askHidden('Confirm password: '))) {
      throw new Error('Passwords do not match.');
    }
  }

  if (args.resetPassword) {
    if (!email.includes('@')) throw new Error(`Not an email address: ${email}`);
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }
  } else {
    validate(email, name, password);
  }

  const dataSource = makeRuntimeDataSource();
  await dataSource.initialize();

  try {
    if (args.resetPassword) {
      await resetPassword(dataSource, email, password);
      process.stdout.write(`Reset the password for ${email}.\n`);
      reportLength(password);
      return;
    }

    if (args.linkAuthor) {
      await assertAuthorLinkable(dataSource, args.linkAuthor);
    }

    const auth = createAuth(dataSource, { allowSignUp: true });
    const created = await auth.api.signUpEmail({
      body: { email, name, password },
    });
    process.stdout.write(`Created admin account for ${email}.\n`);

    reportLength(password);

    if (args.linkAuthor) {
      await linkAuthor(dataSource, args.linkAuthor, created.user.id);
      process.stdout.write(`Writes as existing author "${args.linkAuthor}".\n`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  // The message only: an error object from the auth stack can carry the body
  // it was called with, and that body holds the password.
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
