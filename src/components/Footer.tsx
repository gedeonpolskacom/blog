'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, Share2, Camera, Mail } from 'lucide-react';

const footerLinks = {
  blog: [
    { label: 'Najnowsze artykuły', href: '/blog' },
    { label: 'Trendy', href: '/kategorie/trendy' },
    { label: 'Albumy', href: '/kategorie/albumy' },
    { label: 'Ramki', href: '/kategorie/ramki' },
    { label: 'Media & Papier', href: '/kategorie/media' },
  ],
  inspiracje: [
    { label: 'Galeria Inspiracji', href: '/inspiracje' },
    { label: 'Studia Fotograficzne', href: '/kategorie/studia' },
    { label: 'Nowości Produktowe', href: '/nowosci' },
    { label: 'Porównania', href: '/kategorie/porownania' },
  ],
  gedeon: [
    { label: 'Platforma B2B', href: 'https://b2b.gedeonpolska.com', external: true },
    { label: 'Sklep B2C', href: 'https://gedeonpolska.myshopify.com', external: true },
    { label: 'Albumy Fotograficzne', href: 'https://b2b.gedeonpolska.com/pl/albumy', external: true },
    { label: 'DryLab Media', href: 'https://b2b.gedeonpolska.com/pl/drylab-media', external: true },
    { label: 'Papier KODAK', href: 'https://b2b.gedeonpolska.com/pl/papier-fotograficzny', external: true },
  ],
};

export default function Footer({ lang = 'pl' }: { lang?: 'pl' | 'en' }) {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      background: 'var(--color-black-soft)',
      borderTop: '1px solid var(--glass-border)',
      paddingTop: '4rem',
    }}>
      <div className="container-site">
        {/* Top */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 1fr 1fr',
          gap: '3rem',
          paddingBottom: '3rem',
          borderBottom: '1px solid var(--glass-border)',
        }}
          className="footer-grid"
        >
          {/* Brand */}
          <div>
            <Link href="/" aria-label="Gedeon Polska" style={{ display: 'inline-flex', marginBottom: '1rem' }}>
              <span className="brand-logo-swap" style={{ height: '34px' }}>
                <Image
                  src="/brand/gedeonwh.png"
                  alt="Gedeon Polska"
                  width={220}
                  height={60}
                  className="brand-logo-dark"
                  style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
                />
                <Image
                  src="/brand/gedeon.png"
                  alt="Gedeon Polska"
                  width={220}
                  height={60}
                  className="brand-logo-light"
                  style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
                />
              </span>
            </Link>
            <p style={{ fontSize: '0.85rem', maxWidth: '220px', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              {lang === 'pl'
                ? 'Inspiracje i wiedza dla branży fotograficznej — od producenta z 25-letnią tradycją.'
                : 'Inspiration and knowledge for the photography industry — from a manufacturer with 25 years of tradition.'}
            </p>
            {/* Social */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {[
                { icon: Share2, href: 'https://facebook.com', label: 'Facebook' },
                { icon: Camera, href: 'https://instagram.com', label: 'Instagram' },
                { icon: Mail, href: 'mailto:info@gedeonpolska.com', label: 'Email' },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: '36px', height: '36px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-gray-muted)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-gold)';
                    e.currentTarget.style.color = 'var(--color-gold)';
                    e.currentTarget.style.background = 'var(--color-gold-dim)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                    e.currentTarget.style.color = 'var(--color-gray-muted)';
                    e.currentTarget.style.background = 'var(--glass-bg)';
                  }}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Blog Links */}
          <div>
            <h5 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
              Blog
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {footerLinks.blog.map((link) => (
                <Link key={link.href} href={link.href} style={{ fontSize: '0.875rem', color: 'var(--color-gray-muted)', transition: 'color 0.2s ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-cream)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-gray-muted)')}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Inspiracje */}
          <div>
            <h5 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
              {lang === 'pl' ? 'Inspiracje' : 'Inspiration'}
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {footerLinks.inspiracje.map((link) => (
                <Link key={link.href} href={link.href} style={{ fontSize: '0.875rem', color: 'var(--color-gray-muted)', transition: 'color 0.2s ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-cream)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-gray-muted)')}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Gedeon Links */}
          <div>
            <h5 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
              Gedeon Polska
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {footerLinks.gedeon.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  style={{ fontSize: '0.875rem', color: 'var(--color-gray-muted)', transition: 'color 0.2s ease', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-cream)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-gray-muted)')}
                >
                  {link.label}
                  {link.external && <ExternalLink size={11} />}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.5rem 0', flexWrap: 'wrap', gap: '0.75rem',
        }}>
          <p style={{ fontSize: '0.8rem' }}>
            © {year} GEDEON SP. Z O.O. · Grażyńskiego 74, 43-300 Bielsko-Biała · PL5470243777
          </p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {['Regulamin', 'Polityka Prywatności', 'Cookies'].map((item) => (
              <a key={item} href="#" style={{ fontSize: '0.8rem', color: 'var(--color-gray-muted)', transition: 'color 0.2s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-cream)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-gray-muted)')}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 560px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  );
}
