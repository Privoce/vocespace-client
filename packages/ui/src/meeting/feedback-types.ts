import type { ComponentType } from 'react';
import type { MeetingButtonProps, MeetingInputProps } from '../types';
export interface FeedbackPayload {
  email: string;
  feedbackType: string;
  content: string;
  attachments: string[];
}
export interface FeedbackFormProps {
  t: (key: string) => string;
  accountEmail?: string;
  Button: ComponentType<MeetingButtonProps>;
  Input: ComponentType<MeetingInputProps>;
  onUpload: (email: string) => Promise<{ name: string; url: string } | undefined>;
  onSubmit: (value: FeedbackPayload) => Promise<void>;
  onDone: () => void;
  onBusyChange?: (busy: boolean) => void;
}
