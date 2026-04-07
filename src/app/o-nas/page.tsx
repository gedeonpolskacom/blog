'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Camera, PackageCheck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const FEATURES = [
  {
    icon: Camera,
    title: 'BranĹĽa fotograficzna',
    text: 'Tworzymy i rozwijamy ofertÄ™ dla laboratoriĂłw, fotografĂłw, studiĂłw i sklepĂłw foto.',
  },
  {
    icon: PackageCheck,
    title: 'Produkty i dystrybucja',
    text: 'Albumy, ramki, antyramy, media DryLab i papiery fotograficzne dostÄ™pne dla B2B i detalistĂłw.',
  },
  {
    icon: Building2,
    title: 'Wsparcie handlowe',
    text: 'ĹÄ…czymy content, sprzedaĹĽ i logistykÄ™, ĹĽeby partnerzy szybciej wdraĹĽali nowe kolekcje i produkty.',
  },
];

export default function AboutPage() {
  const [lang, setLang] = useState<'pl' | 'en'>('pl');

  return (
    <>
      <Navbar lang={lang} onLangChange={setLang} />

      <main style={{ paddingTop: '80px' }}>
        <section style={{
          padding: 'clamp(3.5rem, 8vw, 6rem) 0',
          background: 'radial-gradient(circle at top left, rgba(212,168,83,0.12), transparent 45%)',
          borderBottom: '1px solid var(--glass-border)',
        }}>
          <div className="container-site">
            <span className="badge" style={{ marginBottom: '1rem', display: 'inline-flex' }}>GEDEON</span>
            <h1 style={{ maxWidth: '760px', marginBottom: '1rem' }}>
              {lang === 'pl'
                ? 'Producent i dystrybutor rozwiÄ…zaĹ„ dla rynku foto.'
                : 'Manufacturer and distributor for the photo market.'}
            </h1>
            <p style={{ maxWidth: '720px', fontSize: '1.05rem' }}>
              {lang === 'pl'
                ? 'Blog Gedeon wspiera sprzedaĹĽ i edukacjÄ™ wokĂłĹ‚ albumĂłw fotograficznych, ramek, mediĂłw DryLab i papierĂłw KODAK. ĹÄ…czymy wiedzÄ™ produktowÄ… z praktykÄ… rynku B2B.'
                : 'The Gedeon blog supports sales and education around photo albums, frames, DryLab media and KODAK papers. We combine product knowledge with real B2B market practice.'}
            </p>
          </div>
        </section>

        <section style={{ padding: '3rem 0 5rem' }}>
          <div className="container-site" style={{ display: 'grid', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  style={{
                    background: 'var(--color-black-card)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '18px',
                    padding: '1.5rem',
                  }}
                >
                  <Icon size={20} color="var(--color-gold)" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.6rem' }}>{title}</h3>
                  <p style={{ fontSize: '0.95rem', lineHeight: 1.7 }}>{text}</p>
                </div>
              ))}
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(212,168,83,0.12), rgba(212,168,83,0.04))',
              border: '1px solid rgba(212,168,83,0.25)',
              borderRadius: '20px',
              padding: '2rem',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <div style={{ maxWidth: '620px' }}>
                <h2 style={{ fontSize: '1.35rem', marginBottom: '0.7rem' }}>
                  {lang === 'pl' ? 'Chcesz zobaczyÄ‡ ofertÄ™ lub przeczytaÄ‡ poradniki?' : 'Want to browse the offer or read guides?'}
                </h2>
                <p>
                  {lang === 'pl'
                    ? 'PrzejdĹş do platformy B2B albo do sekcji blogowej, gdzie publikujemy nowoĹ›ci, inspiracje i artykuĹ‚y produktowe.'
                    : 'Open the B2B platform or the blog section with product updates, inspirations and guides.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a href="https://b2b.gedeonpolska.com" target="_blank" rel="noopener noreferrer" className="btn-primary">
                  B2B <ArrowRight size={15} />
                </a>
                <Link href="/blog" className="btn-ghost">
                  Blog <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer lang={lang} />
    </>
  );
}


