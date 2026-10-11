import { parseJoinId, parseNativeMediaRequest } from '@vocespace/contracts';
import { enableNativeMedia, nativeMediaStatus } from './lib/server/native-media';
import { requireNative } from './native-auth';
import { ApiRequest, ApiResponse } from './http';

export async function nativeMediaEndpoint(request: ApiRequest) {
  const { token, principal } = await requireNative(request);
  if (!['POST', 'PUT'].includes(request.method)) return new ApiResponse(null, { status: 405 });
  const body = await request.json();
  if (request.method === 'POST')
    return ApiResponse.json(await nativeMediaStatus(principal, parseJoinId(body)));
  const input = parseNativeMediaRequest(body);
  return ApiResponse.json(
    await enableNativeMedia(token, principal, input.joinId, input.device, input.invitationId),
  );
}
