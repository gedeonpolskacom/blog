/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Package, Sparkles, Bell, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  b2bUrl: string;
  imageUrl: string | null;
  inStock: boolean;
  isNew: boolean;
}

// Category → gradient color map
const CATEGORY_COLORS: Record<string, string> = {
  Albumy: 'linear-gradient(135deg, #1a1218 0%, #2d1a2a 100%)',
  Ramki: 'linear-gradient(135deg, #1a1806 0%, #2d2c0a 100%)',
  Media: 'linear-gradient(135deg, #0a0f1a 0%, #101828 100%)',
  KODAK: 'linear-gradient(135deg, #1a0f0a 0%, #2d1c12 100%)',
  Inne:  'linear-gradient(135deg, #0d1a0d 0%, #152615 100%)',
};

function ProductCard({ product, lang }: { product: Product; lang: 'pl' | 'en' }) {
  const coverColor = CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS['Inne'];
  const [imageFit, setImageFit] = useState<'cover' | 'contain'>('cover');
  const [imageError, setImageError] = useState(false);
  const hasImage = Boolean(product.imageUrl) && !imageError;

  const onImageLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    const ratio = naturalWidth / naturalHeight;
    // Square and portrait images look better without crop.
    setImageFit(ratio <= 1.15 ? 'contain' : 'cover');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -5 }}
      style={{
        background: 'var(--color-black-card)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,168,83,0.5)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Product visual */}
      <div style={{
        background: hasImage
          ? 'linear-gradient(180deg, var(--image-overlay-soft) 0%, var(--surface-overlay-soft) 100%)'
          : coverColor,
        aspectRatio: '4 / 3',
        minHeight: '180px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {hasImage && (
          <img
            src={product.imageUrl ?? undefined}
            alt={product.name}
            loading="lazy"
            onLoad={onImageLoad}
            onError={() => setImageError(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: imageFit,
              objectPosition: 'center',
              padding: imageFit === 'contain' ? '0.6rem' : 0,
            }}
          />
        )}

        {!hasImage && (
          <>
            <div style={{ width: '80px', height: '58px', border: '2px solid rgba(212,168,83,0.4)', borderRadius: '4px', position: 'absolute', transform: 'rotate(-5deg)' }} />
            <div style={{ width: '90px', height: '65px', border: '1px solid rgba(212,168,83,0.2)', borderRadius: '4px', position: 'absolute', transform: 'rotate(3deg)' }} />
          </>
        )}

        {/* Badges */}
        <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', display: 'flex', gap: '0.5rem' }}>
          {product.inStock && (
            <span style={{
              background: 'rgba(0,180,0,0.8)', color: '#fff',
              padding: '0.2rem 0.65rem', borderRadius: '100px',
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
            }}>
              {lang === 'pl' ? 'Dostępny' : 'In Stock'}
            </span>
          )}
          <span className="badge" style={{ fontSize: '0.68rem', padding: '0.2rem 0.65rem' }}>
            {product.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          {product.sku}
        </p>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.625rem', lineHeight: 1.3 }}>
          {product.name}
        </h3>
        <p style={{ fontSize: '0.875rem', lineHeight: 1.65, marginBottom: '1.25rem', color: 'var(--color-gray-muted)' }}>
          {product.description}
        </p>
        <a
          href={product.b2bUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}
        >
          {lang === 'pl' ? 'Zamów w B2B' : 'Order in B2B'}
          <ArrowRight size={14} />
        </a>
      </div>
    </motion.div>
  );
}

export default function NowosciPage() {
  const [lang, setLang] = useState<'pl' | 'en'>('pl');
  const [emailAlert, setEmailAlert] = useState('');
  const [alertSubmitted, setAlertSubmitted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/b2b/products?limit=20')
      .then(r => r.json())
      .then(data => {
        if (data.products) {
          setProducts(data.products);
        } else {
          setError(lang === 'pl' ? 'Nie udało się załadować produktów.' : 'Failed to load products.');
        }
      })
      .catch(() => {
        setError(lang === 'pl' ? 'Błąd połączenia z B2B.' : 'B2B connection error.');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Navbar lang={lang} onLangChange={setLang} />

      <main style={{ paddingTop: '80px' }}>
        {/* Hero */}
        <section style={{
          padding: 'clamp(3.5rem, 7vw, 6rem) 0 3rem',
          background: 'radial-gradient(ellipse at 60% 0%, rgba(212,168,83,0.1) 0%, transparent 60%)',
          borderBottom: '1px solid var(--glass-border)',
        }}>
          <div className="container-site">
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="badge" style={{ marginBottom: '1.25rem' }}>
                <Package size={12} />
                {lang === 'pl' ? 'Nowości Produktowe' : 'New Products'}
              </div>
              <h1 style={{ marginBottom: '0.75rem' }}>
                {lang === 'pl' ? (
                  <>Co nowego w <span className="gradient-text-gold">ofercie Gedeon?</span></>
                ) : (
                  <>What&apos;s new in <span className="gradient-text-gold">Gedeon&apos;s offer?</span></>
                )}
              </h1>
              <p style={{ maxWidth: '560px', fontSize: '1.05rem', marginBottom: '2rem' }}>
                {lang === 'pl'
                  ? 'Najświeższe nowości produktowe — albumy, ramki i media. Automatycznie dostępne po przyjęciu do naszego katalogu.'
                  : 'The latest product news — albums, frames and media. Automatically available once added to our catalog.'}
              </p>

              {/* Alert signup */}
              <div style={{
                background: 'var(--color-gold-dim)',
                border: '1px solid rgba(212,168,83,0.3)',
                borderRadius: '12px', padding: '1.25rem 1.5rem',
                display: 'flex', alignItems: 'center', gap: '1rem',
                maxWidth: '560px', flexWrap: 'wrap',
              }}>
                <Bell size={18} color="var(--color-gold)" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: '0.875rem', flex: 1, margin: 0 }}>
                  {lang === 'pl'
                    ? 'Otrzymuj powiadomienie o każdej nowości na email:'
                    : 'Get notified of every new product by email:'}
                </p>
                {alertSubmitted ? (
                  <span style={{ color: 'var(--color-gold)', fontWeight: 600, fontSize: '0.9rem' }}>
                    ✓ {lang === 'pl' ? 'Zapisano!' : 'Subscribed!'}
                  </span>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); if (emailAlert) setAlertSubmitted(true); }} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="email" value={emailAlert} onChange={e => setEmailAlert(e.target.value)}
                      placeholder="email@studio.pl"
                      className="newsletter-input"
                      style={{ width: '220px' }}
                      required
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '0.65rem 1.1rem', fontSize: '0.85rem' }}>
                      {lang === 'pl' ? 'Alert' : 'Alert'}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Products grid */}
        <section style={{ padding: '3rem 0 5rem' }}>
          <div className="container-site">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ width: '4px', height: '28px', background: 'var(--color-gold)', borderRadius: '2px' }} />
              <h2 style={{ fontSize: '1.6rem' }}>
                {lang === 'pl' ? 'Katalog Produktów' : 'Product Catalogue'}
              </h2>
              <div style={{
                marginLeft: 'auto',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                fontSize: '0.8rem', color: 'var(--color-gray-muted)',
              }}>
                <Sparkles size={13} color="var(--color-gold)" />
                {lang === 'pl' ? 'Auto-aktualizacja z PIM' : 'Auto-updated from PIM'}
              </div>
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-gray-muted)' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
                <p>{lang === 'pl' ? 'Ładowanie produktów…' : 'Loading products…'}</p>
              </div>
            )}

            {!loading && error && (
              <div style={{
                textAlign: 'center', padding: '4rem',
                background: 'var(--color-black-card)', borderRadius: '16px',
                border: '1px solid var(--glass-border)', color: 'var(--color-gray-muted)',
              }}>
                <p>{error}</p>
                <a href="https://b2b.gedeonpolska.com" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
                  {lang === 'pl' ? 'Przeglądaj katalog B2B' : 'Browse B2B catalogue'}
                  <ArrowRight size={14} />
                </a>
              </div>
            )}

            {!loading && !error && products.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '4rem',
                background: 'var(--color-black-card)', borderRadius: '16px',
                border: '1px solid var(--glass-border)', color: 'var(--color-gray-muted)',
              }}>
                <p>{lang === 'pl' ? 'Brak produktów do wyświetlenia.' : 'No products available.'}</p>
              </div>
            )}

            {!loading && products.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {products.map(product => (
                  <ProductCard key={product.id} product={product} lang={lang} />
                ))}
              </div>
            )}

            {/* CTA to B2B */}
            <div style={{ textAlign: 'center', marginTop: '3rem', padding: '2.5rem', background: 'var(--color-black-card)', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
              <h3 style={{ marginBottom: '0.75rem' }}>
                {lang === 'pl' ? 'Pełny katalog Gedeon Polska' : 'Full Gedeon Polska catalog'}
              </h3>
              <p style={{ marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                {lang === 'pl'
                  ? 'Ponad 3000 produktów dostępnych od ręki w ilościach hurtowych na platformie B2B.'
                  : 'Over 3,000 products available immediately in wholesale quantities on the B2B platform.'}
              </p>
              <a href="https://b2b.gedeonpolska.com" target="_blank" rel="noopener noreferrer" className="btn-primary">
                {lang === 'pl' ? 'Otwórz katalog B2B' : 'Open B2B catalog'}
                <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </section>

        {/* Related articles */}
        <section style={{ background: 'var(--color-black-soft)', padding: '4rem 0' }}>
          <div className="container-site">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
              <div style={{ width: '4px', height: '28px', background: 'var(--color-gold)', borderRadius: '2px' }} />
              <h3>{lang === 'pl' ? 'Powiązane Artykuły' : 'Related Articles'}</h3>
            </div>
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-muted)', fontSize: '0.9rem' }}>
              <Link href="/blog" style={{ color: 'var(--color-gold)', textDecoration: 'none' }}>
                {lang === 'pl' ? 'Przejdź do Bloga →' : 'Go to Blog →'}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer lang={lang} />

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
