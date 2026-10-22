import { apiFetch } from '@/lib/api/client';
import { connect_endpoint } from '@/lib/std/index';

export interface FeedbackAttachment {
  name: string;
  url: string;
}

export const uploadFeedbackFile = async (file: File, email: string) => {
  const url = new URL(connect_endpoint('/api/feedback'), window.location.origin);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('email', email);

  return await apiFetch(url.toString(), {
    method: 'POST',
    body: formData,
  });
};

export const sendFeedback = async (params: {
  email: string;
  feedbackType: string;
  content: string;
  attachments: string[];
}) => {
  const url = new URL(connect_endpoint('/api/feedback'), window.location.origin);
  return await apiFetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
};