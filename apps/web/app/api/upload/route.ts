import { forwardApi } from '@/lib/server/api-proxy';

export const POST = forwardApi;
export const OPTIONS = forwardApi;
export const dynamic = 'force-dynamic';
