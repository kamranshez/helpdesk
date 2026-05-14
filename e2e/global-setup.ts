import { execSync } from 'node:child_process';
import { randomUUID, scrypt, randomBytes } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Client, Pool } from 'pg';

// ---------------------------------------------------------------------------
// Load server/.env.test — global-setup runs outside of the server process
// ---------------------------------------------------------------------------
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, '$1');
    if (!(key in process.env)) process.env[key] = val;
  }
}

// __dirname is available in CJS (Playwright compiles setup files to CJS)
const ROOT_DIR = path.resolve(__dirname, '..');
loadEnvFile(path.join(ROOT_DIR, 'server', '.env.test'));

// ---------------------------------------------------------------------------
// Password hashing — replicates @better-auth/utils/password exactly.
// Format: `${saltHex}:${keyHex}`, scrypt(N:16384, r:16, p:1, dkLen:64)
// ---------------------------------------------------------------------------
async function hashBetterAuthPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
  return `${salt}:${key.toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Step 1: Create helpdesk_test if it doesn't exist
// ---------------------------------------------------------------------------
async function ensureTestDatabase(): Promise<void> {
  const client = new Client({ connectionString: process.env.POSTGRES_ADMIN_URL! });
  await client.connect();
  const { rows } = await client.query<{ datname: string }>(
    "SELECT datname FROM pg_database WHERE datname = 'helpdesk_test'"
  );
  if (rows.length === 0) {
    await client.query('CREATE DATABASE helpdesk_test');
    console.log('[global-setup] Created database helpdesk_test');
  }
  await client.end();
}

// ---------------------------------------------------------------------------
// Step 2: Run prisma migrate deploy against the test DB
// ---------------------------------------------------------------------------
function runMigrations(): void {
  execSync('bunx prisma migrate deploy', {
    cwd: path.join(ROOT_DIR, 'server'),
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL! },
    stdio: 'inherit',
  });
}

// ---------------------------------------------------------------------------
// Step 3: Seed test users (idempotent)
// Better Auth credential accounts: providerId='credential', accountId=user.id
// ---------------------------------------------------------------------------
async function seedTestUsers(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const now = new Date().toISOString();

  const users = [
    {
      email: process.env.E2E_ADMIN_EMAIL!,
      password: process.env.E2E_ADMIN_PASSWORD!,
      role: 'admin',
      name: 'E2E Admin',
    },
    {
      email: process.env.E2E_AGENT_EMAIL!,
      password: process.env.E2E_AGENT_PASSWORD!,
      role: 'agent',
      name: 'E2E Agent',
    },
  ];

  for (const { email, password, role, name } of users) {
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM "user" WHERE email = $1',
      [email]
    );
    if (rows.length > 0) continue; // already seeded

    const userId = randomUUID();
    const hashedPassword = await hashBetterAuthPassword(password);

    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4, $5, $5)`,
      [userId, name, email, role, now]
    );
    await pool.query(
      `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $3, $4, $5, $5)`,
      [randomUUID(), userId, userId, hashedPassword, now]
    );
    console.log(`[global-setup] Created ${role}: ${email}`);
  }

  await pool.end();
}

// ---------------------------------------------------------------------------
// Entry point — called by Playwright before webServer starts
// ---------------------------------------------------------------------------
export default async function globalSetup(): Promise<void> {
  await ensureTestDatabase();
  runMigrations();
  await seedTestUsers();
  console.log('[global-setup] Done');
}
