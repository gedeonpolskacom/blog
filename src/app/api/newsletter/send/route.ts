/**
 * Newsletter Send Endpoint
 * Route: POST /api/newsletter/send
 *
 * Przyjmuje: { smtp?, from, fromName, to, subject, html }
 * Wysyła jeden e-mail przez Nodemailer, używając env SMTP_* jako fallback.
 * Zwraca: { success, messageId } | { success: false, error }
 */

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface SendRequest {
  smtp?: {
    host?: string;
    port?: number | string;
    user?: string;
    pass?: string;
    useTls?: boolean;
  };
  from?: string;
  fromName?: string;
  to: string;
  subject: string;
  html: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SendRequest;

    if (!body.to || !body.subject || !body.html) {
      return NextResponse.json(
        { success: false, error: 'Brakujące pola: to, subject, html' },
        { status: 400 },
      );
    }

    const host = body.smtp?.host || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(body.smtp?.port || process.env.SMTP_PORT || 587);
    const user = body.smtp?.user || process.env.SMTP_USER || '';
    const pass = body.smtp?.pass || process.env.SMTP_PASS || '';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    const fromAddress = body.from || process.env.SMTP_FROM_EMAIL || user;
    const fromName = body.fromName || process.env.SMTP_FROM_NAME || 'Gedeon Polska';

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: body.to,
      subject: body.subject,
      html: body.html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[newsletter/send]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
