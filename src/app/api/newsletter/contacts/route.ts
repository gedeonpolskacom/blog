import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function GET() {
  try {
    const { data: subscribers, error } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Błąd pobierania subskrybentów:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Map to the format expected by the legacy frontend (app.js)
    const formattedContacts = subscribers.map((sub) => ({
      id: sub.id,
      email: sub.email,
      companyName: '',
      contactName: '',
      discount: '',
      country: sub.lang === 'pl' ? 'Poland' : 'Other',
      folder: sub.source || 'General',
      notes: sub.unsubscribed ? 'Unsubscribed' : (sub.confirmed ? 'Confirmed' : 'Pending'),
      createdAt: sub.created_at,
    }));

    return NextResponse.json(formattedContacts);
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(err) }, { status: 500 });
  }
}
