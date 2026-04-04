import { NextResponse } from 'next/server';

const SYSTEM_ACCOUNT = {
  id: 'system-auto',
  name: 'Systemowa',
  email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'newsletter@gedeonpolska.com',
  displayName: process.env.SMTP_FROM_NAME || 'GEDEON',
  password: '••••••••',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: process.env.SMTP_PORT || '587',
  smtpUser: process.env.SMTP_USER || '',
  useTls: true,
};

export async function GET() {
  return NextResponse.json([SYSTEM_ACCOUNT]);
}

// app.js próbuje zapisywać konta — zwracamy sukces, konfiguracja jest w env
export async function POST() {
  return NextResponse.json({ success: true, id: SYSTEM_ACCOUNT.id });
}
