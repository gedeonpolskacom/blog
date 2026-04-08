import nodemailer from 'nodemailer';
import { supabaseAdmin } from '@/lib/supabase-admin';

type NewsletterSendResult = {
  to: string;
  ok: boolean;
  error?: string;
};

export async function sendNewsletterJob(jobId: string) {
  const client = supabaseAdmin;
  if (!client) {
    throw new Error('supabaseAdmin not available');
  }

  const { data: job, error: fetchErr } = await client
    .from('newsletter_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (fetchErr || !job) {
    throw new Error(fetchErr?.message ?? 'Job not found');
  }

  const recipients: string[] = Array.isArray(job.recipients) ? job.recipients : [];
  if (!recipients.length) {
    throw new Error('Brak odbiorców w jobie');
  }

  const statusBeforeSend = String(job.status ?? '');
  if (!['scheduled', 'draft'].includes(statusBeforeSend)) {
    throw new Error(`Job status "${statusBeforeSend}" nie pozwala na wysyłkę`);
  }

  await client
    .from('newsletter_jobs')
    .update({ status: 'sending' })
    .eq('id', jobId);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
    tls: { rejectUnauthorized: false },
  });

  const fromName = job.sender_name || process.env.SMTP_FROM_NAME || 'Gedeon Polska';
  const fromEmail = job.sender_email || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';

  let ok = 0;
  let fail = 0;
  const results: NewsletterSendResult[] = [];

  for (const to of recipients) {
    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: job.subject,
        html: job.html_content,
      });
      ok++;
      results.push({ to, ok: true });
    } catch (err: unknown) {
      fail++;
      results.push({ to, ok: false, error: err instanceof Error ? err.message : 'error' });
    }
  }

  const finalStatus = fail === 0 ? 'sent' : ok > 0 ? 'partial' : 'failed';

  await client
    .from('newsletter_jobs')
    .update({
      status: finalStatus,
      sent_at: new Date().toISOString(),
      results,
      recipients_count: recipients.length,
    })
    .eq('id', jobId);

  return {
    jobId,
    sent: ok,
    failed: fail,
    status: finalStatus,
    recipientsCount: recipients.length,
  };
}


