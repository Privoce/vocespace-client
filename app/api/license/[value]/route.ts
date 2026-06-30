import { NextRequest, NextResponse } from 'next/server';
import { getLicenseByValue, validateLicense } from '@/lib/db/license';

/**
 * GET /api/license/[value] - Get license by JWT value
 * Used by the client to validate a license value
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { value: string } },
) {
  const { value } = params;

  if (!value) {
    return NextResponse.json({ error: 'Missing license value' }, { status: 400 });
  }

  try {
    // Validate JWT signature and expiration
    validateLicense(value);
  } catch {
    return NextResponse.json({ error: 'License expired or invalid' }, { status: 403 });
  }

  const license = await getLicenseByValue(value);
  if (!license) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  return NextResponse.json(license);
}
