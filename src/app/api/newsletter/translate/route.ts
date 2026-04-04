/**
 * Newsletter AI Translate Endpoint
 * Route: POST /api/newsletter/translate
 *
 * Przyjmuje: { text: string (HTML), baseUrl?: string }
 * Tłumaczy treść newslettera HTML z polskiego na angielski przez Gemini Flash.
 * Zwraca: { success: true, translation: string } | { success: false, error }
 */

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function POST(request: NextRequest) {
  try {
    const { text, baseUrl } = await request.json() as { text: string; baseUrl?: string };

    if (!text) {
      return NextResponse.json({ success: false, error: 'Brak pola text' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const prompt = `Jesteś tłumaczem e-maili marketingowych dla branży fotograficznej (Gedeon Polska).
Przetłumacz poniższy fragment HTML newslettera z polskiego na angielski.

ZASADY:
- Tłumacz TYLKO zawartość tekstową wewnątrz tagów HTML
- NIE zmieniaj struktury HTML, atrybutów, klas, stylów ani URL-i
- Zachowaj profesjonalny, branżowy ton (photo studio, albums, frames)
- Zachowaj podwójne cudzysłowy w atrybutach HTML
${baseUrl ? `- BaseURL produktów: ${baseUrl}` : ''}

Zwróć TYLKO przetłumaczony HTML, bez objaśnień, bez markdown.

HTML DO PRZETŁUMACZENIA:
${text}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const translation = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Usuń ewentualne owijki markdown, które Gemini czasem dodaje
    const cleaned = translation
      .replace(/^```html\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    return NextResponse.json({ success: true, translation: cleaned });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[newsletter/translate]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
