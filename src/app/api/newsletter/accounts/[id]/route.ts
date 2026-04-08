import { NextResponse } from 'next/server';

// Konto systemowe jest konfigurowane przez env — DELETE zwraca sukces bez akcji
export async function DELETE() {
  return NextResponse.json({ success: true });
}

