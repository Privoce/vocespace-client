import { NextRequest, NextResponse } from 'next/server';
import {
  createLicense,
  deleteAllLicenses,
  deleteLicenseById,
  getAllLicenses,
  updateLicense,
  parseLicenseClaims,
  generateLicenseOnly,
} from '@/lib/db/license';
import { sendEmail, fmtContentBuy } from '@/lib/email';
import { getConfig } from '@/app/api/conf/conf';

/**
 * PUT /api/license - Update license
 * Body: { email, value, new_domains, new_email, sendEmail? }
 * Requires hostToken query param for authorization
 */
export async function PUT(request: NextRequest) {
  const hostToken = request.nextUrl.searchParams.get('hostToken');
  const config = getConfig();
  if (!hostToken || hostToken !== config.hostToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { email, value, newDomains, newEmail, sendEmail: sendEmailOpt } = body;

  if (!email || !value) {
    return NextResponse.json({ error: 'Missing required fields: email, value' }, { status: 400 });
  }

  const updated = await updateLicense(value, email, newDomains, newEmail);
  if (!updated) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }

  let sendSuccess = false;
  if (sendEmailOpt) {
    sendSuccess = await sendEmail(
      'han@privoce.com',
      updated.email,
      'VoceSpace License',
      fmtContentBuy(updated.value),
    );
    if (!sendSuccess) {
      console.error(`Failed to send email to ${updated.email} with license value ${updated.value}`);
    }
  }

  return NextResponse.json({
    success: true,
    license_id: updated.id,
    license: updated,
    msg: 'License updated successfully',
    email_sent: sendSuccess,
    email_skipped: !sendEmailOpt,
  });
}

/**
 * DELETE /api/license - Delete license(s)
 * - Without id query param: delete all (for testing)
 * - With id query param: delete single license by id
 * Requires hostToken query param for authorization
 */
export async function DELETE(request: NextRequest) {
  const hostToken = request.nextUrl.searchParams.get('hostToken');
  const config = getConfig();
  if (!hostToken || hostToken !== config.hostToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (id) {
    await deleteLicenseById(id);
    return NextResponse.json({ success: true, msg: 'License deleted' });
  }

  await deleteAllLicenses();
  return NextResponse.json({ success: true, msg: 'All licenses deleted' });
}

/**
 * POST /api/license - Create a new license or import an existing JWT into DB
 * Body (create): { email, domains, created_at?, ilimit?, sendEmail? }
 * Body (import): { value, sendEmail? }
 * sendEmail defaults to true when omitted
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, domains, created_at, ilimit, sendEmail: sendEmailOpt, value } = body as {
    email?: string;
    domains?: string;
    created_at?: number;
    ilimit?: string;
    sendEmail?: boolean;
    value?: string;
  };

  let licenseRow;

  if (value) {
    // Import flow: parse JWT value and insert into DB
    let claims: any;
    try {
      claims = parseLicenseClaims(value);
    } catch {
      return NextResponse.json({ error: 'Invalid JWT token' }, { status: 400 });
    }

    // Check if already in DB
    const { getLicenseByValue: checkExisting } = await import('@/lib/db/license');
    const existing = await checkExisting(value);
    if (existing) {
      return NextResponse.json({ error: 'License already exists in database' }, { status: 409 });
    }

    licenseRow = await createLicense(
      claims.email,
      claims.domains,
      claims.created_at,
      claims.limit || 'pro',
    );
  } else {
    // Create flow
    if (!email || !domains) {
      return NextResponse.json({ error: 'Missing required fields: email, domains' }, { status: 400 });
    }

    const ts = created_at || Math.floor(Date.now() / 1000);
    const type = ilimit || 'pro';

    if (type === 'free') {
      // Free licenses are not stored in DB
      licenseRow = generateLicenseOnly(email, domains, ts, type);
    } else {
      // Pro/enterprise licenses are stored in DB
      try {
        licenseRow = await createLicense(email, domains, ts, type);
      } catch (err: any) {
        return NextResponse.json({ error: `Failed to create license: ${err.message}` }, { status: 500 });
      }
    }
  }

  const sendEmailFlag = sendEmailOpt !== undefined ? sendEmailOpt : true;
  let sendSuccess = false;
  if (sendEmailFlag) {
    sendSuccess = await sendEmail(
      'han@privoce.com',
      licenseRow.email,
      'VoceSpace License',
      fmtContentBuy(licenseRow.value),
    );

    if (!sendSuccess) {
      console.error(`Failed to send email to ${licenseRow.email} with license value ${licenseRow.value}`);
    }
  }

  return NextResponse.json({
    success: true,
    license_id: licenseRow.id,
    license_value: licenseRow.value,
    license: licenseRow,
    msg: 'License created successfully',
    email_sent: sendSuccess,
    email_skipped: !sendEmailFlag,
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
