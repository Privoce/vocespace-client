import { getConfig } from '../lib/server/config';
import { ApiRequest, ApiResponse } from '../http';
import { getLicenseByDomain, validateLicense } from '../lib/db/license';

const VOCESPACE_API = 'https://vocespace.com';

/**
 * GET /api/license/domains/[value] - Get license by domain
 * Used by the server to check if a domain has a valid license
 * When getConfig().billing.stripe.enabled=false, proxy to vocespace.com
 */
export async function GET(
  _request: ApiRequest,
  { params }: { params: { value: string } },
) {
  const { value } = params;

  if (!value) {
    return ApiResponse.json({ error: 'Missing domain value' }, { status: 400 });
  }

  // getConfig().billing.stripe.enabled=false 时，代理到 vocespace.com 处理
  if (!getConfig().billing.stripe.enabled) {
    const proxyRes = await fetch(`${VOCESPACE_API}/api/license/${encodeURIComponent(value)}`, {
      method: 'GET',
    });
    const data = await proxyRes.json();
    return ApiResponse.json(data, { status: proxyRes.status });
  }

  const license = await getLicenseByDomain(value);
  if (!license) {
    return ApiResponse.json({ error: 'License not found' }, { status: 404 });
  }

  try {
    validateLicense(license.value);
  } catch {
    return ApiResponse.json({ error: 'License expired' }, { status: 403 });
  }

  return ApiResponse.json(license);
}
