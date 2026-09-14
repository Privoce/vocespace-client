import { getConfig } from '@/server/config';
import { sendEmail } from '@/server/email';
import { connect_endpoint } from '@/lib/http/paths';
import { mkdir, writeFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
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

function buildAbsoluteFileUrl(request: NextRequest, fileUrl: string): string {
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

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const email = normalizeEmail(String(formData.get('email') || ''));

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file received' }, { status: 400 });
      }

      if (!isValidEmail(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }

      if (file.size > FEEDBACK_MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large' }, { status: 413 });
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
      return NextResponse.json({
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
    const content = String(body.content || '').trim();
    const feedbackType = String(body.feedbackType || '').trim();
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.filter((item: unknown): item is string => typeof item === 'string')
      : [];

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (!feedbackType) {
      return NextResponse.json({ error: 'Feedback type is required' }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: 'Feedback content is required' }, { status: 400 });
    }

    const smtpConf = getConfig().smtp;
    const recipient = smtpConf?.user?.trim();
    if (!recipient) {
      return NextResponse.json({ error: 'SMTP recipient is not configured' }, { status: 500 });
    }

    const sent = await sendEmail(
      email,
      recipient,
      `[VoceSpace Feedback] ${feedbackType}`,
      formatFeedbackEmail({ fromEmail: email, feedbackType, content, attachments }),
    );

    if (!sent) {
      return NextResponse.json({ error: 'Failed to send feedback email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('feedback route error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}