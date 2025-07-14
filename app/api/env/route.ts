// 获取动态配置
import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setStoredConf } from '../conf';

export async function GET(_request: NextRequest) {
  let config = getConfig();
  setStoredConf(config);
  return NextResponse.json(config, { status: 200 });
}
