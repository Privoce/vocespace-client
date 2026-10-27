import { ACCOUNT_AVATAR_MAX_BYTES } from '@vocespace/contracts';
import { AccountError } from '@vocespace/server-core';
import type { ApiRequest } from '../http';

/** Bound the multipart body even when Content-Length is absent or untrusted. */
export async function readAccountAvatar(request: ApiRequest) {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;'))
    throw new AccountError(415, 'AVATAR_INVALID_IMAGE');
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError(400, 'AVATAR_INVALID_IMAGE');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > ACCOUNT_AVATAR_MAX_BYTES + 64 * 1024) {
        await reader.cancel();
        throw new AccountError(413, 'AVATAR_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), { headers: request.headers }).formData();
  } catch {
    throw new AccountError(400, 'AVATAR_INVALID_IMAGE');
  }
  const file = form.get('file');
  if (!(file instanceof File) || form.getAll('file').length !== 1)
    throw new AccountError(400, 'AVATAR_INVALID_IMAGE');
  if (!file.size || file.size >= ACCOUNT_AVATAR_MAX_BYTES)
    throw new AccountError(400, 'AVATAR_TOO_LARGE');
  return { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type };
}
