/**
 * Newsletter subscription API
 * Route: POST /api/newsletter/subscribe
 */

import { NextRequest, NextResponse } from 'next/server';
import { subscribeToNewsletter } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, lang = 'pl', source = 'blog' } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    await subscribeToNewsletter(email, lang, source);

    return NextResponse.json({ 
      success: true,
      message: lang === 'pl' 
        ? 'Dziękujemy za zapis! Sprawdź skrzynkę email.' 
        : 'Thank you! Check your email inbox.',
    });
  } catch (error) {
    // Duplicate email — still return success (user already subscribed)
    if (String(error).includes('duplicate') || String(error).includes('23505')) {
      return NextResponse.json({ 
        success: true, 
        message: 'Już jesteś zapisany na newsletter!' 
      });
    }

    console.error('[Newsletter] Subscribe error:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
