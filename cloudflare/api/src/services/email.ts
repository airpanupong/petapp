import {AppError} from '../lib/errors';

/** Messages "sent" while email is not configured outside production (inspected by local tests). */
export const outbox: {to: string; subject: string; text: string}[] = [];

function addressOf(from: string): string | null {
  const m = from.match(/<([^>]+)>/);
  const addr = (m ? m[1] : from).trim();
  return addr.includes('@') ? addr : null;
}

export async function sendEmail(env: Env, to: string, subject: string, text: string, html?: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (env.APP_ENV === 'production') throw new AppError(503, 'EMAIL_NOT_CONFIGURED', 'Email service is not configured');
    console.log(JSON.stringify({msg: 'email not sent (not configured)', to, subject}));
    outbox.push({to, subject, text});
    return;
  }
  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        from: env.SMTP_FROM,
        to: [to],
        reply_to: addressOf(env.SMTP_FROM),
        subject,
        text,
        ...(html ? {html} : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error(JSON.stringify({msg: 'resend request failed', to, error: String(err)}));
    throw new AppError(503, 'EMAIL_SEND_FAILED', 'Could not send email');
  }
  if (res.status >= 300) {
    console.error(JSON.stringify({msg: 'resend rejected email', to, status: res.status, body: (await res.text()).slice(0, 300)}));
    throw new AppError(503, 'EMAIL_SEND_FAILED', 'Could not send email');
  }
  await res.body?.cancel();
}
