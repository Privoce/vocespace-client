import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/hello 正常情况直接返回{code: 200, message: "hi"}
 * 说明可以正常连通
 * @param _request
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({ code: 200, message: 'hi' });
}
