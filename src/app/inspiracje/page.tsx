import { supabaseAdmin } from '@/lib/supabase-admin';
import { type InspirationPhoto } from '@/lib/supabase';
import InspirationsPageClient from './InspirationsPageClient';

export const dynamic = 'force-dynamic';

async function getInitialInspirations(): Promise<InspirationPhoto[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('inspiration_photos')
      .select('*')
      .eq('is_active', true)
      .lte('display_from', new Date().toISOString())
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[inspiracje/page] Failed to fetch photos:', error.message);
      return [];
    }

    return (data ?? []) as InspirationPhoto[];
  } catch (error) {
    console.error('[inspiracje/page] Unexpected fetch error:', error);
    return [];
  }
}

export default async function InspirationsPage() {
  const initialPhotos = await getInitialInspirations();
  return <InspirationsPageClient initialPhotos={initialPhotos} />;
}

