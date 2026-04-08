'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  Camera,
  BookOpen,
  Image as ImageIcon,
  Newspaper,
  Star,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import ArticleCard from '@/components/ArticleCard';
import Footer from '@/components/Footer';
import { getInspirationPhotos, getPublishedArticles, type Article, type InspirationPhoto } from '@/lib/supabase';
import { hasHomeFeaturedTag } from '@/lib/homepage-featured';
import { resolveCoverImage } from '@/lib/article-cover';

const HeroCanvas = dynamic(() => import('@/components/HeroCanvas'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 30% 50%, rgba(212,168,83,0.12) 0%, transparent 60%)',
      }}
    />
  ),
});

type CardArticle = {
  id: string;
  slug: string;
  title: string;
  titleEn: string;
  excerpt: string;
  excerptEn: string;
  category: string;
  categoryEn: string;
  date: string;
  readTime: string;
  coverColor: string;
  coverImage?: string | null;
};

type CategoryItem = {
  key: string;
  label: string;
  labelEn: string;
  href: string;
  count: number;
  icon: typeof BookOpen;
};

const CATEGORY_META: Record<string, { label: string; labelEn: string; slug: string; icon: typeof BookOpen }> = {
  Albumy: { label: 'Albumy', labelEn: 'Albums', slug: 'albumy', icon: BookOpen },
  Ramki: { label: 'Ramki', labelEn: 'Frames', slug: 'ramki', icon: ImageIcon },
  Media: { label: 'Media', labelEn: 'Media', slug: 'media', icon: Newspaper },
  KODAK: { label: 'KODAK', labelEn: 'KODAK', slug: 'kodak', icon: Camera },
  Trendy: { label: 'Trendy', labelEn: 'Trends', slug: 'trendy', icon: Sparkles },
  Poradniki: { label: 'Poradniki', labelEn: 'Guides', slug: 'poradniki', icon: Star },
  Inne: { label: 'Inne', labelEn: 'Other', slug: 'blog', icon: BookOpen },
};

function formatDate(dateLike: string | null | undefined, lang: 'pl' | 'en') {
  if (!dateLike) return '';
  const parsed = new Date(dateLike);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat(lang === 'pl' ? 'pl-PL' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

function toCardArticle(article: Article, lang: 'pl' | 'en'): CardArticle {
  const meta = CATEGORY_META[article.category] ?? CATEGORY_META.Inne;
  return {
    id: article.id,
    slug: article.slug,
    title: article.title_pl,
    titleEn: article.title_en ?? article.title_pl,
    excerpt: article.excerpt_pl ?? '',
    excerptEn: article.excerpt_en ?? article.excerpt_pl ?? '',
    category: meta.label,
    categoryEn: meta.labelEn,
    date: formatDate(article.published_at ?? article.created_at, lang),
    readTime: `${article.read_time ?? 5} min`,
    coverColor: article.cover_color ?? 'linear-gradient(135deg, #1a1206 0%, #2d1f0a 100%)',
    coverImage: resolveCoverImage(article),
  };
}

function slugifyCategory(raw: string) {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'blog';
}

function HeroSection({ lang }: { lang: 'pl' | 'en' }) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <section className="hero-section">
      <HeroCanvas isMobile={isMobile} />
      <div className="hero-gradient-overlay" />
      <div className="hero-bottom-fade" />

      <div className="container-site hero-content" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          style={{ maxWidth: '750px' }}
        >
          <div className="badge" style={{ marginBottom: '1.5rem' }}>
            <Sparkles size={12} />
            {lang === 'pl' ? 'Gedeon - Blog branżowy' : 'Gedeon - Industry Blog'}
          </div>

          <h1 style={{ marginBottom: '1.5rem' }}>
            {lang === 'pl' ? (
              <>
                Inspiracje dla
                <br />
                <span className="gradient-text-gold">Profesjonalistów Foto</span>
              </>
            ) : (
              <>
                Inspiration for
                <br />
                <span className="gradient-text-gold">Photo Professionals</span>
              </>
            )}
          </h1>

          <p style={{ fontSize: '1.15rem', marginBottom: '2.5rem', maxWidth: '580px' }}>
            {lang === 'pl'
              ? 'Trendy, poradniki i nowości produktowe - wszystko, czego potrzebuje studio fotograficzne, sklep foto i minilab.'
              : 'Trends, guides, and product updates - everything your photo studio, photo shop, and minilab need.'}
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link href="/blog" className="btn-primary">
              {lang === 'pl' ? 'Czytaj blog' : 'Read blog'}
              <ArrowRight size={16} />
            </Link>
            <Link href="/inspiracje" className="btn-ghost">
              {lang === 'pl' ? 'Galeria inspiracji' : 'Inspiration gallery'}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturedArticle({ article, lang }: { article: Article | null; lang: 'pl' | 'en' }) {
  if (!article) {
    return null;
  }

  const coverImage = resolveCoverImage(article);
  const title = lang === 'pl' ? article.title_pl : (article.title_en ?? article.title_pl);
  const excerpt = lang === 'pl' ? (article.excerpt_pl ?? '') : (article.excerpt_en ?? article.excerpt_pl ?? '');
  const categoryMeta = CATEGORY_META[article.category] ?? CATEGORY_META.Inne;

  return (
    <section className="section-padding" style={{ paddingTop: '4rem' }}>
      <div className="container-site">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ width: '4px', height: '28px', background: 'var(--color-gold)', borderRadius: '2px' }} />
          <div className="badge">{lang === 'pl' ? 'Polecany artykuł' : 'Featured article'}</div>
        </div>

        <Link href={`/blog/${article.slug}`}>
          <motion.div
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.3 }}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid var(--glass-border)',
              cursor: 'pointer',
            }}
            className="featured-article-grid"
          >
            <div
              style={{
                minHeight: '420px',
                position: 'relative',
                background: coverImage
                  ? `linear-gradient(180deg, var(--image-overlay-soft) 0%, var(--image-overlay-hero) 100%), url(${coverImage}) center / cover no-repeat`
                  : (article.cover_color ?? 'linear-gradient(135deg, #1a1206 0%, #2d1f0a 50%, #1a1206 100%)'),
              }}
            >
              <div className="badge" style={{ position: 'absolute', top: '1.5rem', left: '1.5rem' }}>
                {lang === 'pl' ? categoryMeta.label : categoryMeta.labelEn}
              </div>
            </div>

            <div
              style={{
                background: 'var(--color-black-card)',
                padding: 'clamp(2rem, 4vw, 3.5rem)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--color-gold)',
                  fontWeight: 500,
                  marginBottom: '1rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {formatDate(article.published_at ?? article.created_at, lang)} · {article.read_time ?? 5}{' '}
                {lang === 'pl' ? 'min czytania' : 'min read'}
              </p>
              <h2 style={{ marginBottom: '1.25rem', lineHeight: 1.25 }}>{title}</h2>
              <p style={{ marginBottom: '2rem' }}>{excerpt}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-gold)', fontWeight: 600, fontSize: '0.9rem' }}>
                {lang === 'pl' ? 'Czytaj artykuł' : 'Read article'}
                <ArrowRight size={16} />
              </div>
            </div>
          </motion.div>
        </Link>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .featured-article-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

function CategoriesSection({ categories, lang }: { categories: CategoryItem[]; lang: 'pl' | 'en' }) {
  return (
    <section className="section-padding">
      <div className="container-site">
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="badge" style={{ marginBottom: '1rem' }}>
            {lang === 'pl' ? 'Kategorie' : 'Categories'}
          </div>
          <h2>{lang === 'pl' ? 'Przeglądaj tematy' : 'Browse topics'}</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link key={cat.key} href={cat.href} style={{ textDecoration: 'none' }}>
                <motion.div className="category-card" whileHover={{ y: -4 }} transition={{ duration: 0.25 }}>
                  <div className="category-icon">
                    <Icon size={22} color="var(--color-gold)" />
                  </div>
                  <h4 style={{ marginBottom: '0.25rem', fontSize: '1rem' }}>
                    {lang === 'pl' ? cat.label : cat.labelEn}
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-muted)' }}>
                    {cat.count} {lang === 'pl' ? 'artykułów' : 'articles'}
                  </p>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LatestArticles({ lang, articles, loading }: { lang: 'pl' | 'en'; articles: Article[]; loading: boolean }) {
  const cards = useMemo(() => articles.map((article) => toCardArticle(article, lang)), [articles, lang]);

  return (
    <section className="section-padding" style={{ paddingTop: 0 }}>
      <div className="container-site">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '4px', height: '28px', background: 'var(--color-gold)', borderRadius: '2px' }} />
            <h2>{lang === 'pl' ? 'Najnowsze artykuły' : 'Latest articles'}</h2>
          </div>
          <Link href="/blog" className="btn-ghost" style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}>
            {lang === 'pl' ? 'Wszystkie artykuły' : 'All articles'}
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div style={{ color: 'var(--color-gray-muted)' }}>{lang === 'pl' ? 'Ładowanie...' : 'Loading...'}</div>
        ) : cards.length === 0 ? (
          <div style={{ color: 'var(--color-gray-muted)' }}>{lang === 'pl' ? 'Brak opublikowanych artykułów.' : 'No published articles yet.'}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {cards.map((article, i) => (
              <ArticleCard key={article.id} article={article} lang={lang} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function InspirationPreview({ lang, items, loading }: { lang: 'pl' | 'en'; items: InspirationPhoto[]; loading: boolean }) {
  return (
    <section className="section-padding" style={{ background: 'var(--color-black-soft)' }}>
      <div className="container-site">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="badge" style={{ marginBottom: '0.75rem' }}>
              <Camera size={12} />
              {lang === 'pl' ? 'Galeria inspiracji' : 'Inspiration gallery'}
            </div>
            <h2>{lang === 'pl' ? 'Najnowsze inspiracje' : 'Latest inspiration'}</h2>
          </div>
          <Link href="/inspiracje" className="btn-ghost" style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}>
            {lang === 'pl' ? 'Cała galeria' : 'Full gallery'}
            <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div style={{ color: 'var(--color-gray-muted)' }}>{lang === 'pl' ? 'Ładowanie...' : 'Loading...'}</div>
        ) : items.length === 0 ? (
          <div style={{ color: 'var(--color-gray-muted)' }}>{lang === 'pl' ? 'Brak aktywnych inspiracji.' : 'No active inspiration photos.'}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'auto auto', gap: '1rem' }}>
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.3 }}
                style={{
                  borderRadius: '12px',
                  overflow: 'hidden',
                  aspectRatio: item.aspect_ratio || '4/3',
                  border: '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  position: 'relative',
                  gridColumn: i === 0 ? '1' : undefined,
                  gridRow: i === 0 ? '1 / 3' : undefined,
                  background: item.url
                    ? `linear-gradient(180deg, var(--image-overlay-soft) 0%, var(--image-overlay-hero) 100%), url(${item.url}) center / cover no-repeat`
                    : '#1a1206',
                }}
              >
                <div style={{ position: 'absolute', bottom: '0.75rem', left: '0.75rem' }}>
                  <span className="badge" style={{ fontSize: '0.65rem', padding: '0.2rem 0.65rem' }}>
                    {item.tag}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function NewsletterSection({ lang }: { lang: 'pl' | 'en' }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail('');
    }
  };

  return (
    <section className="section-padding">
      <div className="container-site">
        <div className="newsletter-section">
          <div className="badge" style={{ marginBottom: '1.5rem' }}>
            <Newspaper size={12} />
            Newsletter
          </div>
          <h2 style={{ marginBottom: '1rem' }}>
            {lang === 'pl' ? 'Bądź na bieżąco z branżą foto' : 'Stay up to date with the photo industry'}
          </h2>
          <p style={{ marginBottom: '2.5rem', maxWidth: '480px', marginInline: 'auto' }}>
            {lang === 'pl'
              ? 'Nowości produktowe Gedeon, trendy rynkowe i ekskluzywne oferty - co 2 tygodnie na Twoją skrzynkę.'
              : 'Gedeon product updates, market trends, and exclusive offers - every 2 weeks in your inbox.'}
          </p>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ color: 'var(--color-gold)', fontWeight: 600, fontSize: '1.1rem' }}
            >
              {lang === 'pl' ? 'Dziękujemy! Zostałeś zapisany.' : 'Thank you! You are subscribed.'}
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', maxWidth: '480px', margin: '0 auto', flexWrap: 'wrap' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={lang === 'pl' ? 'Twój adres e-mail...' : 'Your email address...'}
                className="newsletter-input"
                style={{ flex: 1, minWidth: '240px' }}
                required
              />
              <button type="submit" className="btn-primary">
                {lang === 'pl' ? 'Subskrybuj' : 'Subscribe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [lang, setLang] = useState<'pl' | 'en'>('pl');
  const [articles, setArticles] = useState<Article[]>([]);
  const [inspirations, setInspirations] = useState<InspirationPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [publishedArticles, inspirationPhotos] = await Promise.all([
          getPublishedArticles({ limit: 60 }),
          getInspirationPhotos(),
        ]);

        if (!cancelled) {
          setArticles(publishedArticles);
          setInspirations(inspirationPhotos.slice(0, 6));
        }
      } catch (error) {
        console.error('Homepage data load failed:', error);
        if (!cancelled) {
          setArticles([]);
          setInspirations([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const featuredArticle = useMemo(() => {
    const tagged = articles.find((article) => hasHomeFeaturedTag(article.tags));
    return tagged ?? articles[0] ?? null;
  }, [articles]);

  const latestArticles = useMemo(() => {
    if (!featuredArticle) return articles.slice(0, 6);
    return articles.filter((article) => article.id !== featuredArticle.id).slice(0, 6);
  }, [articles, featuredArticle]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();

    for (const article of articles) {
      const key = article.category || 'Inne';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const items = Array.from(counts.entries())
      .map(([key, count]) => {
        const meta = CATEGORY_META[key] ?? {
          label: key,
          labelEn: key,
          slug: slugifyCategory(key),
          icon: BookOpen,
        };
        return {
          key,
          label: meta.label,
          labelEn: meta.labelEn,
          href: meta.slug === 'blog' ? '/blog' : `/kategorie/${meta.slug}`,
          count,
          icon: meta.icon,
        } satisfies CategoryItem;
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    if (items.length > 0) {
      return items;
    }

    return Object.entries(CATEGORY_META)
      .filter(([key]) => key !== 'Inne')
      .map(([key, meta]) => ({
        key,
        label: meta.label,
        labelEn: meta.labelEn,
        href: `/kategorie/${meta.slug}`,
        count: 0,
        icon: meta.icon,
      }));
  }, [articles]);

  return (
    <>
      <Navbar lang={lang} onLangChange={setLang} />
      <main>
        <HeroSection lang={lang} />
        <FeaturedArticle article={featuredArticle} lang={lang} />
        <CategoriesSection categories={categories} lang={lang} />
        <LatestArticles lang={lang} articles={latestArticles} loading={loading} />
        <InspirationPreview lang={lang} items={inspirations} loading={loading} />
        <NewsletterSection lang={lang} />
      </main>
      <Footer lang={lang} />
    </>
  );
}

