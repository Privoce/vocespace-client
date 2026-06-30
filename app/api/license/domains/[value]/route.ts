import { NextRequest, NextResponse } from 'next/server';
import { getLicenseByDomain, validateLicense } from '@/lib/db/license';

const WEBHOOK = process.env.WEBHOOK ?? false;
const VOCESPACE_API = 'https://vocespace.com';

/**
 * GET /api/license/domains/[value] - Get license by domain
 * Used by the server to check if a domain has a valid license
 * When WEBHOOK=false, proxy to vocespace.com
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { value: string } },
) {
  const { value } = params;

  if (!value) {
    return NextResponse.json({ error: 'Missing domain value' }, { status: 400 });
  }

  // WEBHOOK=false 时，代理到 vocespace.com 处理
  if (!WEBHOOK) {
    const proxyRes = await fetch(`${VOCESPACE_API}/api/license/${encodeURIComponent(value)}`, {
      method: 'GET',
    });
    const data = await proxyRes.json();
    return NextResponse.json(data, { status: proxyRes.status });
  }

  const license = await getLicenseByDomain(value);
  if (!license) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  try {
    validateLicense(license.value);
  } catch {
    return NextResponse.json({ error: 'License expired' }, { status: 403 });
  }

  return NextResponse.json(license);
}
