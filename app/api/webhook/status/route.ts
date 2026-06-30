import { NextResponse } from 'next/server';

const WEBHOOK = process.env.WEBHOOK === 'true';

export async function GET() {
  return NextResponse.json({ webhook: WEBHOOK });
}
