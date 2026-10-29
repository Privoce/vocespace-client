import { getConfig } from '../lib/server/config';
import { ApiResponse } from '../http';


export async function GET() {
  return ApiResponse.json({ webhook: getConfig().billing.stripe.enabled });
}
