import { connect_endpoint, FileType } from '../std';

export interface FeedbackAttachment {
  name: string;
  url: string;
}

export const uploadFeedbackFile = async (file: FileType, email: string) => {
  const url = new URL(connect_endpoint('/api/feedback'), window.location.origin);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('email', email);

  return await fetch(url.toString(), {
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
  return await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
};