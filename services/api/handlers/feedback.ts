import { membership, AccessError, safeSegment } from '../access';
import { sessions, sessionToken } from '../lib/server/sessions';
import { requireNativeChatMember } from '../lib/server/native-chat';
import { parseJoinId } from '@vocespace/contracts';
import { getConfig } from '../lib/server/config';
import { sendEmail } from '../lib/email';
const connect_endpoint = (url: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${url}`;
import { mkdir, writeFile } from 'fs/promises';
import { ApiRequest, ApiResponse } from '../http';
import path from 'path';

const FEEDBACK_MAX_FILE_SIZE = 10 * 1024 * 1024;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeEmailDirectory(email: string): string {
  return normalizeEmail(email).replace(/[^a-z0-9@._-]/g, '_');
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getUploadsRoot(): string {
  return path.join(process.cwd(), 'uploads', 'feedback');
}

function buildAbsoluteFileUrl(request: ApiRequest, fileUrl: string): string {
  return new URL(connect_endpoint(fileUrl), request.nextUrl.origin).toString();
}

function formatFeedbackEmail({
  fromEmail,
  feedbackType,
  content,
  attachments,
}: {
  fromEmail: string;
  feedbackType: string;
  content: string;
  attachments: string[];
}): string {
  const attachmentHtml = attachments.length
    ? `<ul>${attachments
        .map(
          (attachment) =>
            `<li><a href="${escapeHtml(attachment)}" target="_blank" rel="noreferrer">${escapeHtml(attachment)}</a></li>`,
        )
        .join('')}</ul>`
    : '<p>No attachments</p>';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>VoceSpace Feedback</title>
  </head>
  <body style="margin:0;padding:24px;background:#111827;font-family:Arial,sans-serif;color:#e5e7eb;">
    <div style="max-width:720px;margin:0 auto;background:#1f2937;border-radius:16px;padding:24px;">
      <h1 style="margin:0 0 16px;color:#22ccee;font-size:24px;">VoceSpace Feedback</h1>
      <p style="margin:0 0 8px;"><strong>From:</strong> ${escapeHtml(fromEmail)}</p>
      <p style="margin:0 0 8px;"><strong>Type:</strong> ${escapeHtml(feedbackType)}</p>
      <div style="margin:20px 0;padding:16px;background:#111827;border-radius:12px;white-space:pre-wrap;line-height:1.6;">${escapeHtml(content)}</div>
      <div>
        <h2 style="font-size:16px;color:#f3f4f6;">Attachments</h2>
        ${attachmentHtml}
      </div>
    </div>
  </body>
</html>`;
}

export async function POST(request: ApiRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const email = normalizeEmail(String(formData.get('email') || ''));

      if (!(file instanceof File)) {
        return ApiResponse.json({ error: 'No file received' }, { status: 400 });
      }

      if (!isValidEmail(email)) {
        return ApiResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }

      if (file.size > FEEDBACK_MAX_FILE_SIZE) {
        return ApiResponse.json({ error: 'File too large' }, { status: 413 });
      }

      const emailDir = sanitizeEmailDirectory(email);
      const uploadDir = path.join(getUploadsRoot(), emailDir);
      await mkdir(uploadDir, { recursive: true });

      const extension = path.extname(file.name);
      const baseName = path.basename(file.name, extension);
      const nextFileName = `${sanitizeFileName(baseName)}-${crypto.randomUUID()}${extension}`;
      const filePath = path.join(uploadDir, nextFileName);

      const bytes = await file.arrayBuffer();
      await writeFile(filePath, Buffer.from(bytes));

      const fileUrl = `/uploads/feedback/${emailDir}/${nextFileName}`;
      return ApiResponse.json({
        success: true,
        fileUrl,
        absoluteUrl: buildAbsoluteFileUrl(request, fileUrl),
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }

    const body = await request.json();
    const email = normalizeEmail(body.email || '');
    let content = String(body.content || '').trim();
    const report = body.varient === 'report';
    if (body.varient !== undefined && !['feedback', 'report'].includes(body.varient))
      throw new AccessError(400, 'INVALID_FEEDBACK_VARIANT');
    if (report) {
      const principal = await sessions.read(sessionToken(request.headers));
      if (!principal) throw new AccessError(401, 'SESSION_REQUIRED');
      if (!safeSegment(body.target?.id)) throw new AccessError(400, 'INVALID_REPORT_TARGET');
      const spaceName = principal.client === 'native'
        ? (await requireNativeChatMember(principal, parseJoinId(body))).spaceName : body.target.spaceName;
      if (!safeSegment(spaceName)) throw new AccessError(400, 'INVALID_SPACE');
      const member = await membership(principal, spaceName);
      const target = member.info.participants[body.target.id];
      if (!member.participant || !target || body.target.id === member.id)
        throw new AccessError(403, 'INVALID_REPORT_TARGET');
      if (!content) throw new AccessError(400, 'REPORT_CONTENT_REQUIRED');
      content = `Space: ${spaceName}\nReported member: ${target.name} (${body.target.id})\nReporter: ${member.id}\n\n${content}`;
    }
    const feedbackType = String(body.feedbackType || '').trim();
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter((item: unknown): item is string => typeof item === 'string')
      : [];

    if (!isValidEmail(email)) {
      return ApiResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (!feedbackType) {
      return ApiResponse.json({ error: 'Feedback type is required' }, { status: 400 });
    }

    if (!content) {
      return ApiResponse.json({ error: 'Feedback content is required' }, { status: 400 });
    }

    const smtpConf = getConfig().smtp;
    const recipient = smtpConf?.user?.trim();
    if (!recipient) {
      return ApiResponse.json({ error: 'SMTP recipient is not configured' }, { status: 500 });
    }

    const sent = await sendEmail(
      email,
      recipient,
      `[VoceSpace ${report ? 'User Report' : 'Feedback'}] ${feedbackType}`,
      formatFeedbackEmail({ fromEmail: email, feedbackType, content, attachments }),
    );

    if (!sent) {
      return ApiResponse.json({ error: 'Failed to send feedback email' }, { status: 500 });
    }

    return ApiResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AccessError) return ApiResponse.json({ code: error.code }, { status: error.status });
    console.error('feedback delivery failed');
    return ApiResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}