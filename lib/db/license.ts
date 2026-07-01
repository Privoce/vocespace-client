import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const DB_DIR = path.join(process.cwd(), 'sql');
const SHARD_PREFIX = 'licenses';
const MAX_PER_SHARD = 1000;
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

// --- Shard utilities ---

function shardFileName(index: number): string {
  return index === 0 ? `${SHARD_PREFIX}.json` : `${SHARD_PREFIX}.${index}.json`;
}

function shardFilePath(index: number): string {
  return path.join(DB_DIR, shardFileName(index));
}

/** List all existing shard file paths, sorted by index ascending */
function getShardFiles(): string[] {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    return [];
  }
  const files = fs.readdirSync(DB_DIR);
  const shardFiles: { index: number; name: string }[] = [];

  for (const f of files) {
    // Match licenses.json (index 0) and licenses.{n}.json (index n)
    const match = f.match(new RegExp(`^${SHARD_PREFIX}(?:\\.(\\d+))?\\.json$`));
    if (match) {
      const index = match[1] !== undefined ? parseInt(match[1], 10) : 0;
      shardFiles.push({ index, name: f });
    }
  }

  shardFiles.sort((a, b) => a.index - b.index);
  return shardFiles.map((sf) => path.join(DB_DIR, sf.name));
}

/** Read a single shard file */
function readShard(filePath: string): LicenseRow[] {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // corrupted file, return empty
  }
  return [];
}

/** Read all shard files and merge into one array */
function readAll(): LicenseRow[] {
  const files = getShardFiles();
  const all: LicenseRow[] = [];
  for (const f of files) {
    all.push(...readShard(f));
  }
  return all;
}

/**
 * Write all licenses, distributing across shard files.
 * Each shard holds at most MAX_PER_SHARD records.
 * Existing shard files that are no longer needed are deleted.
 */
function writeAll(licenses: LicenseRow[]): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const existingFiles = getShardFiles();
  const neededShards = Math.ceil(licenses.length / MAX_PER_SHARD) || 1;

  // Write each shard
  for (let i = 0; i < neededShards; i++) {
    const start = i * MAX_PER_SHARD;
    const end = Math.min(start + MAX_PER_SHARD, licenses.length);
    const chunk = licenses.slice(start, end);
    const fp = shardFilePath(i);
    fs.writeFileSync(fp, JSON.stringify(chunk, null, 2), 'utf-8');
  }

  // Delete orphaned shard files
  for (const existingFile of existingFiles) {
    const baseName = path.basename(existingFile);
    // Check if this file is still needed
    let isNeeded = false;
    for (let i = 0; i < neededShards; i++) {
      if (baseName === shardFileName(i)) {
        isNeeded = true;
        break;
      }
    }
    if (!isNeeded) {
      fs.unlinkSync(existingFile);
    }
  }
}

// --- Public API ---

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
  ilimit: string = 'pro',
): Promise<LicenseRow> {
  const expires_at = created_at + 60 * 60 * 24 * 365; // 1 year
  const id = crypto.randomUUID();
  const value = generateLicenseValue(id, email, domains, created_at, expires_at, ilimit);

  const licenses = readAll();
  const row: LicenseRow = { id, email, domains, created_at, expires_at, value, ilimit };
  licenses.push(row);
  writeAll(licenses);

  return row;
}

/**
 * Generate a license value without writing to DB (for free licenses)
 */
export function generateLicenseOnly(
  email: string,
  domains: string,
  created_at: number,
  ilimit: string = 'free',
): LicenseRow {
  const expires_at = created_at + 60 * 60 * 24 * 365; // 1 year
  const id = crypto.randomUUID();
  const value = generateLicenseValue(id, email, domains, created_at, expires_at, ilimit);
  return { id, email, domains, created_at, expires_at, value, ilimit };
}

export async function getLicenseByValue(value: string): Promise<LicenseRow | undefined> {
  const files = getShardFiles();
  for (const f of files) {
    const rows = readShard(f);
    const found = rows.find((l) => l.value === value);
    if (found) return found;
  }
  return undefined;
}

export async function getLicenseByDomain(domain: string): Promise<LicenseRow | undefined> {
  const files = getShardFiles();
  for (const f of files) {
    const rows = readShard(f);
    const found = rows.find((l) => l.domains === domain);
    if (found) return found;
  }
  return undefined;
}

export async function updateLicense(
  value: string,
  email: string,
  newDomains?: string,
  newEmail?: string,
): Promise<LicenseRow | undefined> {
  const licenses = readAll();
  const idx = licenses.findIndex((l) => l.value === value && l.email === email);
  if (idx === -1) return undefined;

  const license = licenses[idx];
  const updatedDomains = newDomains && newDomains !== '' && newDomains !== license.domains
    ? newDomains
    : license.domains;
  const updatedEmail = newEmail && newEmail !== '' && newEmail !== license.email
    ? newEmail
    : license.email;

  licenses[idx] = { ...license, domains: updatedDomains, email: updatedEmail };
  writeAll(licenses);

  return licenses[idx];
}

export async function deleteLicenseById(id: string): Promise<void> {
  const licenses = readAll();
  const filtered = licenses.filter((l) => l.id !== id);
  if (filtered.length !== licenses.length) {
    writeAll(filtered);
  }
}

export async function deleteAllLicenses(): Promise<void> {
  const files = getShardFiles();
  for (const f of files) {
    fs.unlinkSync(f);
  }
}

export async function getAllLicenses(): Promise<LicenseRow[]> {
  const licenses = readAll();
  return licenses.sort((a, b) => b.created_at - a.created_at);
}
