import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function GET() {
  try {
    const { data: subscribers, error } = await supabase
      .from('newsletter_subscribers')
      .select('source');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Get unique sources and append them to 'General'
    const sources = subscribers.map((sub) => sub.source || 'General');
    const folders = [...new Set(sources)].sort();
    
    if (!folders.includes('General')) folders.unshift('General');

    return NextResponse.json(folders);
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(err) }, { status: 500 });
  }
}
