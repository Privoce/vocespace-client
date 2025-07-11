// 获取动态配置
import { STORED_CONF } from '@/lib/std/conf';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  return NextResponse.json(STORED_CONF, { status: 200 });
}
