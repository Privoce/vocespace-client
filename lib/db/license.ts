import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const DB_PATH = path.join(process.cwd(), 'vocespace_license.db');
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'privoce_vocespace_secret_key';

export interface LicenseRow {
  id: string;
  email: string;
  domains: string;
  created_at: number;
  expires_at: number;
  value: string;
  ilimit: string;
}

export interface LicenseClaims {
  email: string;
  expires_at: number;
  created_at: number;
  domains: string;
  limit: string;
  id: string;
}

let _db: SqlJsDatabase | null = null;
let _initPromise: Promise<void> | null = null;

async function getDb(): Promise<SqlJsDatabase> {
  if (!_db) {
    if (!_initPromise) {
      _initPromise = initDb();
    }
    await _initPromise;
  }
  return _db!;
}

async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buffer);
  } else {
    _db = new SQL.Database();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS license (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      domains TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      value TEXT NOT NULL,
      ilimit TEXT NOT NULL
    )
  `);

  saveDb();
}

function saveDb() {
  if (_db) {
    const data = _db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

export function generateLicenseValue(
  id: string,
  email: string,
  domains: string,
  timestamp: number,
  expires_at: number,
  limit: string,
): string {
  const payload: LicenseClaims = {
    email,
    expires_at,
    created_at: timestamp,
    domains,
    limit,
    id,
  };
  return jwt.sign(payload, LICENSE_SECRET, { algorithm: 'HS256' });
}

export function parseLicenseClaims(licenseValue: string): LicenseClaims {
  const claims = jwt.verify(licenseValue, LICENSE_SECRET, {
    algorithms: ['HS256'],
  }) as LicenseClaims;
  return claims;
}

export function validateLicense(licenseValue: string): LicenseClaims {
  const claims = parseLicenseClaims(licenseValue);
  const now = Math.floor(Date.now() / 1000);
  if (claims.expires_at <= now) {
    throw new Error('License is expired');
  }
  if (claims.created_at > now) {
    throw new Error('License is not yet valid');
  }
  return claims;
}

export async function createLicense(
  email: string,
  domains: string,
  created_at: number,
): Promise<LicenseRow> {
  const expires_at = created_at + 60 * 60 * 24 * 365; // 1 year
  const id = crypto.randomUUID();
  const ilimit = 'pro';
  const value = generateLicenseValue(id, email, domains, created_at, expires_at, ilimit);

  const db = await getDb();
  db.run(
    'INSERT INTO license (id, email, domains, created_at, expires_at, value, ilimit) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, email, domains, created_at, expires_at, value, ilimit],
  );
  saveDb();

  return { id, email, domains, created_at, expires_at, value, ilimit };
}

export async function getLicenseByValue(value: string): Promise<LicenseRow | undefined> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM license WHERE value = ?');
  stmt.bind([value]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    stmt.free();
    return {
      id: row.id,
      email: row.email,
      domains: row.domains,
      created_at: row.created_at,
      expires_at: row.expires_at,
      value: row.value,
      ilimit: row.ilimit,
    };
  }
  stmt.free();
  return undefined;
}

export async function getLicenseByDomain(domain: string): Promise<LicenseRow | undefined> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM license WHERE domains = ?');
  stmt.bind([domain]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    stmt.free();
    return {
      id: row.id,
      email: row.email,
      domains: row.domains,
      created_at: row.created_at,
      expires_at: row.expires_at,
      value: row.value,
      ilimit: row.ilimit,
    };
  }
  stmt.free();
  return undefined;
}

export async function updateLicense(
  value: string,
  email: string,
  newDomains?: string,
  newEmail?: string,
): Promise<LicenseRow | undefined> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM license WHERE value = ? AND email = ?');
  stmt.bind([value, email]);
  let license: LicenseRow | undefined;
  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    license = {
      id: row.id,
      email: row.email,
      domains: row.domains,
      created_at: row.created_at,
      expires_at: row.expires_at,
      value: row.value,
      ilimit: row.ilimit,
    };
  }
  stmt.free();
  if (!license) return undefined;

  const updatedDomains = newDomains && newDomains !== '' && newDomains !== license.domains
    ? newDomains
    : license.domains;
  const updatedEmail = newEmail && newEmail !== '' && newEmail !== license.email
    ? newEmail
    : license.email;

  db.run('UPDATE license SET domains = ?, email = ? WHERE id = ?', [updatedDomains, updatedEmail, license.id]);
  saveDb();

  return { ...license, domains: updatedDomains, email: updatedEmail };
}

export async function deleteAllLicenses(): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM license');
  saveDb();
}

export async function getAllLicenses(): Promise<LicenseRow[]> {
  const db = await getDb();
  const results: LicenseRow[] = [];
  const stmt = db.prepare('SELECT * FROM license ORDER BY created_at DESC');
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    results.push({
      id: row.id,
      email: row.email,
      domains: row.domains,
      created_at: row.created_at,
      expires_at: row.expires_at,
      value: row.value,
      ilimit: row.ilimit,
    });
  }
  stmt.free();
  return results;
}
