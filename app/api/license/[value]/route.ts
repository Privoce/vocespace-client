import { NextRequest, NextResponse } from 'next/server';
import { getLicenseByValue, parseLicenseClaims } from '@/lib/db/license';

interface ValidateResult {
  inDb: boolean;
  valid: boolean;
  invalidFields?: string[];
  license?: any;
  claims?: any;
}

/**
 * GET /api/license/[value] - Validate a license JWT value
 * - If license exists in DB → valid (return license)
 * - If license not in DB → validate JWT fields individually, return which fields are invalid
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { value: string } },
) {
  const { value } = params;

  if (!value) {
    return NextResponse.json({ error: 'Missing license value' }, { status: 400 });
  }

  // 1. Try to parse JWT claims
  let claims: any;
  try {
    claims = parseLicenseClaims(value);
  } catch {
    return NextResponse.json({ error: 'Invalid JWT token' }, { status: 400 });
  }

  // 2. Check DB (with error resilience — if sql.js fails, treat as not in DB)
  let license: any;
  try {
    license = await getLicenseByValue(value);
  } catch (e) {
    console.error('DB unavailable for license validation:', e);
    // DB unavailable, fall through to JWT-only validation below
  }

  if (license) {
    // In DB → check expiration
    const now = Math.floor(Date.now() / 1000);
    const valid = license.expires_at > now && license.created_at <= now;
    const result: ValidateResult = {
      inDb: true,
      valid,
      license,
    };
    if (!valid) {
      const invalidFields: string[] = [];
      if (license.expires_at <= now) invalidFields.push('expires_at');
      if (license.created_at > now) invalidFields.push('created_at');
      result.invalidFields = invalidFields;
    }
    return NextResponse.json(result);
  }

  // 3. Not in DB → validate each field
  const invalidFields: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  // validate email
  if (!claims.email || typeof claims.email !== 'string' || !claims.email.includes('@')) {
    invalidFields.push('email');
  }

  // validate domains
  if (!claims.domains || typeof claims.domains !== 'string' || claims.domains.trim() === '') {
    invalidFields.push('domains');
  }

  // validate created_at
  if (typeof claims.created_at !== 'number' || claims.created_at > now) {
    invalidFields.push('created_at');
  }

  // validate expires_at
  if (typeof claims.expires_at !== 'number' || claims.expires_at <= now) {
    invalidFields.push('expires_at');
  }

  // validate limit
  if (!claims.limit || !['free', 'pro', 'enterprise', 'room'].includes(claims.limit)) {
    invalidFields.push('limit');
  }

  // validate id
  if (!claims.id || typeof claims.id !== 'string' || claims.id.trim() === '') {
    invalidFields.push('id');
  }

  const result: ValidateResult = {
    inDb: false,
    valid: invalidFields.length === 0,
    claims,
  };

  if (invalidFields.length > 0) {
    result.invalidFields = invalidFields;
  }

  return NextResponse.json(result);
}
