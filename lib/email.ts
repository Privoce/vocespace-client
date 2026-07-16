import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || '';

let _transporter: nodemailer.Transporter | null = null;

function resolveAuthUser(fromEmail: string): string {
  return SMTP_USER || fromEmail;
}

function resolveFromAddress(fromEmail: string): string {
  return SMTP_FROM || fromEmail;
}

function getTransporter(fromEmail: string): nodemailer.Transporter {
  if (!_transporter) {
    const authUser = resolveAuthUser(fromEmail);
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: authUser,
        pass: SMTP_PASS,
      },
    });
  }
  return _transporter;
}

export async function sendEmail(
  from: string,
  to: string,
  subject: string,
  content: string,
): Promise<boolean> {
  try {
    if (!SMTP_PASS) {
      console.error('Failed to send email: SMTP_PASS is not configured');
      return false;
    }

    const transporter = getTransporter(from);
    const fromAddress = resolveFromAddress(from);

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html: content,
    });
    return true;
  } catch (err) {
    console.error('Failed to send email:', {
      error: err,
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      authUser: resolveAuthUser(from),
      fromAddress: resolveFromAddress(from),
      to,
      subject,
    });
    return false;
  }
}

const SMTP_CONTENT_BUY = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>VoceSpace</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #212429">
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      bgcolor="#212429"
    >
      <tr>
        <td align="center">
          <table
            width="660"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="min-width: 660px; background-color: #212429; padding: 12px"
          >
            <tr>
              <td align="center" style="padding: 30px 30px 0 30px">
                <h1
                  style="color: #22ccee; font-weight: 900; letter-spacing: 4px"
                >
                  VoceSpace
                </h1>
              </td>
            </tr>

            <tr>
              <td
                align="left"
                style="
                  padding: 20px 0;
                  font-family: Helvetica, Arial, sans-serif;
                  color: #6f7786;
                  font-size: 16px;
                  font-weight: bold;
                  line-height: 1.5em;
                  text-align: justify;
                "
              >
                Thank you for purchasing VoceSpace Professional Edition. The
                following is your License. Please keep it safe.
              </td>
            </tr>

            <tr>
              <td align="center" bgcolor="#1f1f20" style="padding: 10px">
                <div
                  style="
                    font-family: Verdana, sans-serif;
                    font-size: 16px;
                    color: #22ccee;
                    font-weight: bold;
                  "
                >
                  License
                </div>
                <div
                  style="
                    font-family: Verdana, sans-serif;
                    font-size: 16px;
                    color: #ffffff;
                    font-weight: 500;
                    margin-top: 6px;
                  "
                >
                  \${license}
                </div>
              </td>
            </tr>

            <tr>
              <td
                align="left"
                style="
                  padding: 10px 0px;
                  font-family: Helvetica, Arial, sans-serif;
                  color: #aec0d1;
                  font-size: 14px;
                  font-weight: bold;
                  line-height: 1.5;
                  text-align: justify;
                "
              >
                You have received this automatically generated email because you
                have successfully purchased VoceSpace Professional Edition. This
                email is automatically sent by the system service. Please do not
                reply.
              </td>
            </tr>

            <tr>
              <td
                align="left"
                style="
                  padding: 10px 0;
                  font-family: Helvetica, Arial, sans-serif;
                  color: #aec0d1;
                  font-size: 14px;
                  font-weight: bold;
                  line-height: 1.5;
                "
              >
                If you have any questions or need any help, please contact:
              </td>
            </tr>

            <tr>
              <td
                align="right"
                style="
                  padding: 10px 0px;
                  font-family: Helvetica, Arial, sans-serif;
                  font-size: 14px;
                "
              >
                <a
                  href="mailto:han@privoce.com"
                  style="
                    color: #22ccee;
                    font-weight: bold;
                    text-decoration: none;
                  "
                  >Email: han@privoce.com</a
                ><br />
                <span style="color: #22ccee; font-weight: bold"
                  >WeChat: Privoce</span
                >
              </td>
            </tr>

            <tr>
              <td height="40"></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export function fmtContentBuy(license: string): string {
  return SMTP_CONTENT_BUY.replace('\${license}', license);
}

const SMTP_CONTENT_CANCEL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>VoceSpace</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #212429">
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      bgcolor="#212429"
    >
      <tr>
        <td align="center">
          <table
            width="660"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="min-width: 660px; background-color: #212429; padding: 12px"
          >
            <tr>
              <td align="center" style="padding: 30px 30px 0 30px">
                <h1
                  style="color: #22ccee; font-weight: 900; letter-spacing: 4px"
                >
                  VoceSpace
                </h1>
              </td>
            </tr>

            <tr>
              <td
                align="left"
                style="
                  padding: 20px 0;
                  font-family: Helvetica, Arial, sans-serif;
                  color: #6f7786;
                  font-size: 16px;
                  font-weight: bold;
                  line-height: 1.5em;
                  text-align: justify;
                "
              >
                Your VoceSpace subscription cancellation request has been processed.
              </td>
            </tr>

            <tr>
              <td align="center" bgcolor="#1f1f20" style="padding: 10px">
                <div
                  style="
                    font-family: Verdana, sans-serif;
                    font-size: 16px;
                    color: #22ccee;
                    font-weight: bold;
                  "
                >
                  Cancellation Status
                </div>
                <div
                  style="
                    font-family: Verdana, sans-serif;
                    font-size: 16px;
                    color: #ffffff;
                    font-weight: 500;
                    margin-top: 6px;
                  "
                >
                  \${message}
                </div>
              </td>
            </tr>

            <tr>
              <td
                align="left"
                style="
                  padding: 10px 0px;
                  font-family: Helvetica, Arial, sans-serif;
                  color: #aec0d1;
                  font-size: 14px;
                  font-weight: bold;
                  line-height: 1.5;
                  text-align: justify;
                "
              >
                This email is sent automatically by the system. Please do not reply directly.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

export function fmtContentCancel(message: string): string {
  return SMTP_CONTENT_CANCEL.replace('\${message}', message);
}
