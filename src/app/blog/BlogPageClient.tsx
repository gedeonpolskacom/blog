'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, BookOpen, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ArticleCard from '@/components/ArticleCard';
import { type Article } from '@/lib/supabase';
import { resolveCoverImage } from '@/lib/article-cover';

const ARTICLES_PER_PAGE = 9;

const CATEGORIES_FILTER = [
  { id: 'all', label: 'Wszystkie', labelEn: 'All' },
  { id: 'Albumy', label: 'Albumy', labelEn: 'Albums' },
  { id: 'Ramki', label: 'Ramki', labelEn: 'Frames' },
  { id: 'Media', label: 'Media', labelEn: 'Media' },
  { id: 'KODAK', label: 'KODAK', labelEn: 'KODAK' },
  { id: 'Trendy', label: 'Trendy', labelEn: 'Trends' },
  { id: 'Poradniki', label: 'Poradniki', labelEn: 'Guides' },
];

// Maps DB Article to the shape ArticleCard expects
function toCardShape(a: Article) {
  const CATEGORY_EN: Record<string, string> = {
    Albumy: 'Albums', Ramki: 'Frames', Media: 'Media',
    KODAK: 'KODAK', Trendy: 'Trends', Poradniki: 'Guides',
  };
  const date = a.published_at
    ? new Date(a.published_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  return {
    id: a.id,
    slug: a.slug,
    title: a.title_pl,
    titleEn: a.title_en ?? a.title_pl,
    excerpt: a.excerpt_pl ?? '',
    excerptEn: a.excerpt_en ?? a.excerpt_pl ?? '',
    category: a.category,
    categoryEn: CATEGORY_EN[a.category] ?? a.category,
    date,
    readTime: a.read_time ? `${a.read_time} min` : '5 min',
    coverColor: a.cover_color ?? 'linear-gradient(135deg, #1a1206 0%, #2d1f0a 100%)',
    coverImage: resolveCoverImage(a),
    featured: false,
  };
}

const TRENDING_TOPICS = [
  'Albumy Lniane', 'DryLab 2026', 'Trendy Ĺšlubne', 'KODAK Satin', 'Studio Komunia', 'Ramki Drewniane',
];

export default function BlogPageClient({
  initialArticles,
}: {
  initialArticles: Article[];
}) {
  const [lang, setLang] = useState<'pl' | 'en'>('pl');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allArticles] = useState<ReturnType<typeof toCardShape>[]>(
    () => initialArticles.map(toCardShape)
  );
  const [currentPage, setCurrentPage] = useState(1);
  const loading = false;

  const filtered = useMemo(() => {
    let list = allArticles;
    if (activeCategory !== 'all') {
      list = list.filter(a => a.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, searchQuery, allArticles]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ARTICLES_PER_PAGE));
  const paginatedArticles = useMemo(() => {
    const start = (currentPage - 1) * ARTICLES_PER_PAGE;
    return filtered.slice(start, start + ARTICLES_PER_PAGE);
  }, [currentPage, filtered]);

  return (
    <>
      <Navbar lang={lang} onLangChange={setLang} />

      <main style={{ paddingTop: '80px' }}>
        {/* Hero */}
        <section style={{
          padding: 'clamp(3.5rem, 7vw, 6rem) 0 0',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.09) 0%, transparent 65%)',
          borderBottom: '1px solid var(--glass-border)',
        }}>
          <div className="container-site">
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <BookOpen size={16} color="var(--color-gold)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Blog
                </span>
              </div>
              <h1 style={{ marginBottom: '0.75rem' }}>
                {lang === 'pl' ? (
                  <>Wiedza dla <span className="gradient-text-gold">BranĹĽy Foto</span></>
                ) : (
                  <>Knowledge for the <span className="gradient-text-gold">Photo Industry</span></>
                )}
              </h1>
              <p style={{ fontSize: '1.05rem', maxWidth: '560px', marginBottom: '2.5rem' }}>
                {lang === 'pl'
                  ? 'ArtykuĹ‚y, poradniki i nowoĹ›ci produktowe od Gedeon â€” producenta albumĂłw, ramek i mediĂłw fotograficznych.'
                  : 'Articles, guides and product news from Gedeon â€” manufacturer of albums, frames and photo media.'}
              </p>
            </motion.div>

            {/* Search */}
            <div style={{ position: 'relative', maxWidth: '520px', marginBottom: '2rem' }}>
              <Search size={16} style={{
                position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--color-gold)',
              }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={lang === 'pl' ? 'Szukaj artykuĹ‚Ăłw...' : 'Search articles...'}
                className="newsletter-input"
                style={{ paddingLeft: '2.75rem' }}
              />
            </div>

            {/* Trending pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginRight: '0.25rem', fontSize: '0.78rem', color: 'var(--color-gray-muted)' }}>
                <TrendingUp size={13} />
                {lang === 'pl' ? 'Popularne:' : 'Trending:'}
              </div>
              {TRENDING_TOPICS.map(topic => (
                <button
                  key={topic}
                  onClick={() => {
                    setSearchQuery(topic);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '100px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    color: 'var(--color-gray-muted)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-gold)'; e.currentTarget.style.color = 'var(--color-gold)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--color-gray-muted)'; }}
                >
                  {topic}
                </button>
              ))}
            </div>

            {/* Category filter tabs */}
            <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', paddingBottom: '1px' }}>
              {CATEGORIES_FILTER.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px 8px 0 0',
                    border: `1px solid ${activeCategory === cat.id ? 'var(--color-gold)' : 'var(--glass-border)'}`,
                    borderBottom: activeCategory === cat.id ? '1px solid var(--surface-page)' : '1px solid var(--glass-border)',
                    background: activeCategory === cat.id ? 'var(--surface-page)' : 'transparent',
                    color: activeCategory === cat.id ? 'var(--color-gold)' : 'var(--color-gray-muted)',
                    fontSize: '0.85rem',
                    fontWeight: activeCategory === cat.id ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {lang === 'pl' ? cat.label : cat.labelEn}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Articles Grid */}
        <section style={{ padding: '3rem 0 5rem' }}>
          <div className="container-site">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Filter size={14} color="var(--color-gold)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--color-gray-muted)' }}>
                  {filtered.length} {lang === 'pl' ? 'artykuĹ‚Ăłw' : 'articles'}
                  {activeCategory !== 'all' && ` Â· ${activeCategory}`}
                  {searchQuery && ` Â· "${searchQuery}"`}
                </span>
              </div>
              {(searchQuery || activeCategory !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setActiveCategory('all'); setCurrentPage(1); }}
                  style={{
                    fontSize: '0.8rem', color: 'var(--color-gold)', background: 'none',
                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
                  }}
                >
                  âś• {lang === 'pl' ? 'WyczyĹ›Ä‡ filtry' : 'Clear filters'}
                </button>
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCategory}-${searchQuery}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--color-gray-muted)' }}>
                    <Sparkles size={48} color="var(--color-gold)" style={{ margin: '0 auto 1.5rem', opacity: 0.3 }} />
                    <p>{lang === 'pl' ? 'Ĺadowanie artykuĹ‚Ăłwâ€¦' : 'Loading articlesâ€¦'}</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
                    <Sparkles size={48} color="var(--color-gold)" style={{ margin: '0 auto 1.5rem', opacity: 0.4 }} />
                    <h3 style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>
                      {lang === 'pl' ? 'Brak wynikĂłw' : 'No results'}
                    </h3>
                    <p>{lang === 'pl' ? 'SprĂłbuj innego wyszukiwania lub kategorii.' : 'Try a different search or category.'}</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {paginatedArticles.map((article, i) => (
                      <ArticleCard key={article.id} article={article} lang={lang} index={i} />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {!loading && filtered.length > ARTICLES_PER_PAGE && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                marginTop: '2rem', flexWrap: 'wrap',
              }}>
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '0.7rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: currentPage === 1 ? 'var(--glass-bg)' : 'var(--color-black-card)',
                    color: currentPage === 1 ? 'var(--color-gray-muted)' : 'var(--color-cream)',
                    cursor: currentPage === 1 ? 'default' : 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.84rem',
                  }}
                >
                  {lang === 'pl' ? 'â† Poprzednia' : 'â† Previous'}
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-gray-muted)' }}>
                  {lang === 'pl'
                    ? `Strona ${currentPage} z ${totalPages}`
                    : `Page ${currentPage} of ${totalPages}`}
                </span>
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '0.7rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: currentPage === totalPages ? 'var(--glass-bg)' : 'var(--color-black-card)',
                    color: currentPage === totalPages ? 'var(--color-gray-muted)' : 'var(--color-cream)',
                    cursor: currentPage === totalPages ? 'default' : 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.84rem',
                  }}
                >
                  {lang === 'pl' ? 'NastÄ™pna â†’' : 'Next â†’'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Bottom CTA */}
        <section style={{ paddingBottom: '5rem' }}>
          <div className="container-site">
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem',
            }} className="cta-grid">
              <div style={{
                background: 'linear-gradient(135deg, rgba(212,168,83,0.15) 0%, rgba(212,168,83,0.05) 100%)',
                border: '1px solid rgba(212,168,83,0.3)',
                borderRadius: '20px', padding: '2.5rem',
                display: 'flex', flexDirection: 'column', gap: '1rem',
              }}>
                <span className="badge">B2B</span>
                <h3 style={{ fontSize: '1.5rem' }}>
                  {lang === 'pl' ? 'Platforma dla HurtownikĂłw' : 'Wholesale Platform'}
                </h3>
                <p>
                  {lang === 'pl'
                    ? 'Albumy, ramki, DryLab media i papier KODAK â€” zamĂłw hurtowo dla Twojego studia lub sklepu.'
                    : 'Albums, frames, DryLab media and KODAK paper â€” order wholesale for your studio or shop.'}
                </p>
                <a href="https://b2b.gedeonpolska.com" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                  {lang === 'pl' ? 'OtwĂłrz platformÄ™ B2B' : 'Open B2B Platform'}
                  <ArrowRight size={15} />
                </a>
              </div>

              <div style={{
                background: 'var(--color-black-card)',
                border: '1px solid var(--glass-border)',
                borderRadius: '20px', padding: '2.5rem',
                display: 'flex', flexDirection: 'column', gap: '1rem',
              }}>
                <span className="badge">{lang === 'pl' ? 'Inspiracje' : 'Gallery'}</span>
                <h3 style={{ fontSize: '1.5rem' }}>
                  {lang === 'pl' ? 'Galeria Inspiracji' : 'Inspiration Gallery'}
                </h3>
                <p>
                  {lang === 'pl'
                    ? 'PrzeglÄ…daj zdjÄ™cia naszych produktĂłw w akcji â€” albumy, ramki i media piÄ™knie sfotografowane.'
                    : 'Browse photos of our products in action â€” albums, frames and media beautifully photographed.'}
                </p>
                <Link href="/inspiracje" className="btn-ghost" style={{ alignSelf: 'flex-start' }}>
                  {lang === 'pl' ? 'Zobacz galeriÄ™' : 'View gallery'}
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer lang={lang} />

      <style jsx>{`
        .cta-grid { grid-template-columns: 1fr 1fr; }
        @media (max-width: 700px) {
          .cta-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

