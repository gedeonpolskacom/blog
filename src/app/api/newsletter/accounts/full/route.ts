import { NextResponse } from 'next/server';

// Zwraca konto z pełnymi danymi SMTP (używane przez panel Send do wysyłki)
export async function GET() {
  return NextResponse.json([{
    id: 'system-auto',
    name: process.env.SMTP_FROM_NAME || 'GEDEON',
    email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '',
    displayName: process.env.SMTP_FROM_NAME || 'GEDEON',
    password: process.env.SMTP_PASS || '',
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: process.env.SMTP_PORT || '587',
    smtpUser: process.env.SMTP_USER || '',
    useTls: true,
  }]);
}
