import { NextRequest, NextResponse } from 'next/server';
import {
  createLicense,
  deleteAllLicenses,
  getAllLicenses,
  updateLicense,
} from '@/lib/db/license';
import { sendEmail, fmtContentBuy } from '@/lib/email';
import { getConfig } from '@/app/api/conf/conf';

/**
 * PUT /api/license - Update license
 * Body: { email, value, new_domains, new_email }
 * Requires hostToken query param for authorization
 */
export async function PUT(request: NextRequest) {
  const hostToken = request.nextUrl.searchParams.get('hostToken');
  const config = getConfig();
  if (!hostToken || hostToken !== config.hostToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { email, value, newDomains, newEmail } = body;

  if (!email || !value) {
    return NextResponse.json({ error: 'Missing required fields: email, value' }, { status: 400 });
  }

  const updated = await updateLicense(value, email, newDomains, newEmail);
  if (!updated) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, license_id: updated.id, msg: 'License updated successfully' });
}

/**
 * DELETE /api/license - Delete all licenses (for testing)
 * Requires hostToken query param for authorization
 */
export async function DELETE(request: NextRequest) {
  const hostToken = request.nextUrl.searchParams.get('hostToken');
  const config = getConfig();
  if (!hostToken || hostToken !== config.hostToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await deleteAllLicenses();
  return NextResponse.json({ success: true, msg: 'All licenses deleted' });
}

/**
 * POST /api/license - Create a new license
 * Body: { email, domains, created_at }
 * Can also accept a hostToken for authorization when sending email
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, domains, created_at } = body as { email: string; domains: string; created_at: number };

  if (!email || !domains) {
    return NextResponse.json({ error: 'Missing required fields: email, domains' }, { status: 400 });
  }

  const ts = created_at || Math.floor(Date.now() / 1000);
  let licenseRow;
  try {
    licenseRow = await createLicense(email, domains, ts);
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to create license: ${err.message}` }, { status: 500 });
  }

  // Try to send email with license value
  const sendSuccess = await sendEmail(
    'han@privoce.com',
    email,
    'VoceSpace License',
    fmtContentBuy(licenseRow.value),
  );

  if (!sendSuccess) {
    console.error(`Failed to send email to ${email} with license value ${licenseRow.value}`);
  }

  return NextResponse.json({
    success: true,
    license_id: licenseRow.id,
    license_value: licenseRow.value,
    msg: 'License created successfully',
    email_sent: sendSuccess,
  });
}

/**
 * GET /api/license - Get all licenses
 * Requires hostToken query param for authorization
 */
export async function GET(request: NextRequest) {
  const hostToken = request.nextUrl.searchParams.get('hostToken');
  const config = getConfig();
  if (!hostToken || hostToken !== config.hostToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const licenses = await getAllLicenses();
  return NextResponse.json({ licenses });
}
