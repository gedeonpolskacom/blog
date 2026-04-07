'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X, Moon, Sun } from 'lucide-react';
import { clsx } from 'clsx';

const navLinks = [
  { href: '/blog', label: 'Blog', labelEn: 'Blog' },
  { href: '/inspiracje', label: 'Inspiracje', labelEn: 'Inspiration' },
  { href: '/nowosci', label: 'Nowosci', labelEn: 'New Products' },
  { href: '/kategorie/albumy', label: 'Albumy', labelEn: 'Albums' },
  { href: '/o-nas', label: 'O nas', labelEn: 'About' },
];

interface NavbarProps {
  lang?: 'pl' | 'en';
  onLangChange?: (lang: 'pl' | 'en') => void;
}

const THEME_STORAGE_KEY = 'gedeon-theme';

export default function Navbar({ lang = 'pl', onLangChange }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const applyTheme = (nextTheme: 'dark' | 'light') => {
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.body?.setAttribute('data-theme', nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Local storage may be unavailable in private mode.
    }
    document.cookie = `gedeon-theme=${nextTheme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.body?.setAttribute('data-theme', savedTheme);
      }
    } catch {
      // no-op
    }
  }, []);

  const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <nav className={clsx('navbar', scrolled && 'scrolled')}>
      <div className="container-site">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} aria-label="Gedeon">
            <span className="brand-logo-swap brand-image">
              <Image
                src="/brand/gedeonwh_1.png"
                alt="Gedeon"
                width={240}
                height={64}
                priority
                className="brand-logo-dark"
                style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
              />
              <Image
                src="/brand/gedeon.png"
                alt="Gedeon"
                width={240}
                height={64}
                priority
                className="brand-logo-light"
                style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
              />
            </span>
          </Link>

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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

            <button
              className="theme-btn"
              type="button"
              aria-label="Przelacz motyw"
              title="Przelacz motyw"
              onClick={toggleTheme}
            >
              <span className="theme-icon theme-icon-sun" aria-hidden="true"><Sun size={16} /></span>
              <span className="theme-icon theme-icon-moon" aria-hidden="true"><Moon size={16} /></span>
            </button>

            <a
              href="https://b2b.gedeonpolska.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary hidden-mobile"
              style={{ padding: '0.6rem 1.25rem', fontSize: '0.8rem' }}
            >
              Platforma B2B {'->'}
            </a>

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

        {mobileOpen && (
          <div style={{
            position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0,
            background: 'var(--surface-overlay-strong)',
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
              <button
                className="theme-btn"
                type="button"
                aria-label="Przelacz motyw"
                onClick={toggleTheme}
                style={{ width: '42px', height: '42px' }}
              >
                <span className="theme-icon theme-icon-sun" aria-hidden="true"><Sun size={18} /></span>
                <span className="theme-icon theme-icon-moon" aria-hidden="true"><Moon size={18} /></span>
              </button>
            </div>
            <a href="https://b2b.gedeonpolska.com" className="btn-primary" target="_blank" rel="noopener noreferrer">
              Platforma B2B {'->'}
            </a>
          </div>
        )}
      </div>

      <style jsx>{`
        .hidden-mobile { display: flex; }
        .show-mobile { display: none; }
        .theme-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .theme-icon-moon {
          display: none;
        }
        :global(html[data-theme="light"]) .theme-icon-sun {
          display: none;
        }
        :global(html[data-theme="light"]) .theme-icon-moon {
          display: inline-flex;
        }
        .brand-image {
          height: 34px;
        }
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
          .brand-image {
            height: 30px;
          }
        }
      `}</style>
    </nav>
  );
}
