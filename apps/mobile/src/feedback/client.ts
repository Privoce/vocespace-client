import type { FeedbackPayload } from '@vocespace/ui';
import type { createNativeApi } from '../api/session';
export type FeedbackBody = FormData | FeedbackPayload;
export type FeedbackSend = (
  body: FeedbackBody,
) => Promise<{ absoluteUrl?: string; fileUrl: string }>;
/** Uses the existing Native session; feedback does not require joining an RTC room. */
export async function sendFeedback(api: ReturnType<typeof createNativeApi>, body: FeedbackBody) {
  const response = await api.sdk.transport('api/v1/native/feedback', {
    method: 'POST',
    ...(body instanceof FormData
      ? { body }
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error('FEEDBACK_FAILED');
  return response.json();
}
