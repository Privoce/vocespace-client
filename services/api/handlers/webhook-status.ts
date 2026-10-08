import { ApiResponse } from '../http';

const WEBHOOK = process.env.WEBHOOK === 'true';

export async function GET() {
  return ApiResponse.json({ webhook: WEBHOOK });
}
