'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BookOpen } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ArticleCard from '@/components/ArticleCard';
import { getPublishedArticles, type Article } from '@/lib/supabase';

const CATEGORY_MAP: Record<string, { pl: string; en: string; db: string }> = {
  albumy: { pl: 'Albumy', en: 'Albums', db: 'Albumy' },
  ramki: { pl: 'Ramki', en: 'Frames', db: 'Ramki' },
  media: { pl: 'Media', en: 'Media', db: 'Media' },
  trendy: { pl: 'Trendy', en: 'Trends', db: 'Trendy' },
  poradniki: { pl: 'Poradniki', en: 'Guides', db: 'Poradniki' },
  kodak: { pl: 'KODAK', en: 'KODAK', db: 'KODAK' },
};

function toCardShape(a: Article) {
  const CATEGORY_EN: Record<string, string> = {
    Albumy: 'Albums', Ramki: 'Frames', Media: 'Media',
    KODAK: 'KODAK', Trendy: 'Trends', Poradniki: 'Guides',
  };

  return {
    id: a.id,
    slug: a.slug,
    title: a.title_pl,
    titleEn: a.title_en ?? a.title_pl,
    excerpt: a.excerpt_pl ?? '',
    excerptEn: a.excerpt_en ?? a.excerpt_pl ?? '',
    category: a.category,
    categoryEn: CATEGORY_EN[a.category] ?? a.category,
    date: a.published_at
      ? new Date(a.published_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
      : '',
    readTime: a.read_time ? `${a.read_time} min` : '5 min',
    coverColor: a.cover_color ?? 'linear-gradient(135deg, #1a1206 0%, #2d1f0a 100%)',
    coverImage: a.cover_image ?? null,
  };
}

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const [lang, setLang] = useState<'pl' | 'en'>('pl');
  const [articles, setArticles] = useState<ReturnType<typeof toCardShape>[]>([]);
  const [loading, setLoading] = useState(true);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ slug }) => {
      setCategorySlug(slug);
      const category = CATEGORY_MAP[slug];
      if (!category) {
        setLoading(false);
        return;
      }

      getPublishedArticles({ category: category.db })
        .then((rows) => setArticles(rows.map(toCardShape)))
        .catch(console.error)
        .finally(() => setLoading(false));
    });
  }, [params]);

  const category = useMemo(() => (
    categorySlug ? CATEGORY_MAP[categorySlug] : null
  ), [categorySlug]);

  if (categorySlug && !category) {
    notFound();
  }

  return (
    <>
      <Navbar lang={lang} onLangChange={setLang} />

      <main style={{ paddingTop: '80px' }}>
        <section style={{
          padding: 'clamp(3.5rem, 8vw, 6rem) 0 2rem',
          borderBottom: '1px solid var(--glass-border)',
          background: 'radial-gradient(circle at top center, rgba(212,168,83,0.1), transparent 42%)',
        }}>
          <div className="container-site">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <BookOpen size={16} color="var(--color-gold)" />
              <span className="badge">{lang === 'pl' ? 'Kategoria' : 'Category'}</span>
            </div>
            <h1 style={{ marginBottom: '1rem' }}>
              {lang === 'pl' ? category?.pl : category?.en}
            </h1>
            <p style={{ maxWidth: '680px', fontSize: '1rem' }}>
              {lang === 'pl'
                ? 'Artykuły i inspiracje z wybranej kategorii produktowej Gedeon Polska.'
                : 'Articles and inspirations for the selected Gedeon Polska product category.'}
            </p>
          </div>
        </section>

        <section style={{ padding: '3rem 0 5rem' }}>
          <div className="container-site">
            {loading ? (
              <p style={{ color: 'var(--color-gray-muted)' }}>Ładowanie...</p>
            ) : articles.length === 0 ? (
              <div style={{
                background: 'var(--color-black-card)',
                border: '1px solid var(--glass-border)',
                borderRadius: '18px',
                padding: '2rem',
              }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>
                  {lang === 'pl' ? 'Brak artykułów w tej kategorii' : 'No articles in this category yet'}
                </h2>
                <p style={{ marginBottom: '1rem' }}>
                  {lang === 'pl'
                    ? 'Wróć do pełnej listy bloga lub sprawdź inne sekcje.'
                    : 'Go back to the full blog listing or check other sections.'}
                </p>
                <Link href="/blog" className="btn-primary">
                  Blog <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {articles.map((article, index) => (
                  <ArticleCard key={article.id} article={article} lang={lang} index={index} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer lang={lang} />
    </>
  );
}
