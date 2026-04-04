'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';

const navLinks = [
  { href: '/blog', label: 'Blog', labelEn: 'Blog' },
  { href: '/inspiracje', label: 'Inspiracje', labelEn: 'Inspiration' },
  { href: '/nowosci', label: 'Nowości', labelEn: 'New Products' },
  { href: '/kategorie/albumy', label: 'Albumy', labelEn: 'Albums' },
  { href: '/o-nas', label: 'O nas', labelEn: 'About' },
];

interface NavbarProps {
  lang?: 'pl' | 'en';
  onLangChange?: (lang: 'pl' | 'en') => void;
}

export default function Navbar({ lang = 'pl', onLangChange }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={clsx('navbar', scrolled && 'scrolled')}>
      <div className="container-site">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
            <div style={{
              width: '36px', height: '36px',
              background: 'var(--color-gold)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookOpen size={18} color="var(--color-black)" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.1rem',
                color: 'var(--color-cream)',
                lineHeight: 1,
              }}>
                Gedeon
              </div>
              <div style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.65rem',
                color: 'var(--color-gold)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                lineHeight: 1,
                marginTop: '2px',
              }}>
                Blog & Inspiracje
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }} className="hidden-mobile">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-gray-muted)',
                  transition: 'color 0.2s ease',
                  letterSpacing: '0.01em',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-cream)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-gray-muted)')}
              >
                {lang === 'pl' ? link.label : link.labelEn}
              </Link>
            ))}
          </div>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Language Toggle */}
            <div className="lang-toggle hidden-mobile">
              <button
                className={clsx('lang-btn', lang === 'pl' && 'active')}
                onClick={() => onLangChange?.('pl')}
              >
                PL
              </button>
              <button
                className={clsx('lang-btn', lang === 'en' && 'active')}
                onClick={() => onLangChange?.('en')}
              >
                EN
              </button>
            </div>

            {/* B2B CTA */}
            <a
              href="https://b2b.gedeonpolska.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary hidden-mobile"
              style={{ padding: '0.6rem 1.25rem', fontSize: '0.8rem' }}
            >
              Platforma B2B →
            </a>

            {/* Mobile Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-cream)', padding: '0.25rem',
              }}
              className="show-mobile"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div style={{
            position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0,
            background: 'rgba(10,10,10,0.98)',
            backdropFilter: 'blur(20px)',
            padding: '2rem',
            display: 'flex', flexDirection: 'column', gap: '1.5rem',
            zIndex: 99,
          }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  color: 'var(--color-cream)',
                }}
              >
                {lang === 'pl' ? link.label : link.labelEn}
              </Link>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className={clsx('lang-btn', lang === 'pl' && 'active')}
                onClick={() => onLangChange?.('pl')}
                style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}
              >
                PL
              </button>
              <button
                className={clsx('lang-btn', lang === 'en' && 'active')}
                onClick={() => onLangChange?.('en')}
                style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}
              >
                EN
              </button>
            </div>
            <a href="https://b2b.gedeonpolska.com" className="btn-primary" target="_blank" rel="noopener noreferrer">
              Platforma B2B →
            </a>
          </div>
        )}
      </div>

      <style jsx>{`
        .hidden-mobile { display: flex; }
        .show-mobile { display: none; }
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
      `}</style>
    </nav>
  );
}
