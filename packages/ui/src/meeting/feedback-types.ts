import type { ComponentType } from 'react';
import type { MeetingButtonProps, MeetingInputProps } from '../types';
export enum FebType { Feedback = 'feedback', Report = 'report' }
export interface ReportTarget { id: string; name: string; spaceName: string }
export interface FeedbackPayload {
  varient?: FebType;
  target?: ReportTarget;
  joinId?: string;
  email: string;
  feedbackType: string;
  content: string;
  attachments: string[];
}
export interface FeedbackFormProps {
  varient?: FebType;
  target?: ReportTarget;
  t: (key: string) => string;
  accountEmail?: string;
  Button: ComponentType<MeetingButtonProps>;
  Input: ComponentType<MeetingInputProps>;
  onUpload: (email: string) => Promise<{ name: string; url: string } | undefined>;
  onSubmit: (value: FeedbackPayload) => Promise<void>;
  onDone: () => void;
  onBusyChange?: (busy: boolean) => void;
}
