/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PenLine, Sparkles, Calendar, Package, BarChart3,
  CheckCircle, Clock, FileText, RefreshCw, Send,
  Trash2, Plus, Zap, TrendingUp, BookOpen,
  ArrowRight, AlertCircle, ChevronDown, ChevronRight,
  Lightbulb, Filter, Mail, Link2, Search, Square,
  Image as ImageIcon, Upload, Copy, Eye, EyeOff,
} from 'lucide-react';
import {
  hasHomeFeaturedTag,
  withHomeFeaturedTag,
  withoutHomeFeaturedTag,
} from '@/lib/homepage-featured';

// Types

interface Draft {
  id: string;
  slug?: string;
  title_pl: string;
  excerpt_pl?: string;
  category: string;
  tags?: string[];
  is_home_featured?: boolean;
  cover_image?: string | null;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  source: 'manual' | 'ai_generated' | 'pim_trigger';
  created_at: string;
  scheduled_for?: string;
  views?: number;
}

interface Topic {
  id: string;
  title_pl: string;
  title_en?: string;
  category?: string;
  keywords?: string[];
  source?: string;
  status: 'pending' | 'approved' | 'rejected' | 'generated';
  created_at: string;
  generated_article_slug?: string;
  generated_article_id?: string;
}

interface Stats {
  drafts: number;
  published: number;
  scheduled: number;
  subscribers: number;
  topics: number;
}

interface InspirationAsset {
  id: string;
  title?: string | null;
  title_en?: string | null;
  tag: string;
  storage_path?: string | null;
  url?: string | null;
  display_from: string;
  display_until?: string | null;
  is_active: boolean;
  sort_order: number;
  aspect_ratio: string;
  linked_product_id?: string | null;
  created_at: string;
}

interface InspirationStorageStats {
  bucket: string;
  filesCount: number;
  usedBytes: number;
  usedMb: number | null;
  quotaBytes: number | null;
  quotaMb: number | null;
  remainingBytes: number | null;
  remainingMb: number | null;
  usagePercent: number | null;
  truncated: boolean;
  error: string | null;
}

const INSPIRATION_TAGS = ['albumy', 'ramki', 'media', 'studio'];
const INSPIRATION_RATIOS = ['1/1', '4/3', '3/2', '16/9', '9/16', '3/4', '2/3'];
const ARTICLE_CATEGORIES = ['Albumy', 'Ramki', 'Media', 'KODAK', 'Trendy', 'Poradniki', 'Inne'] as const;

type InspirationEditDraft = {
  title: string;
  title_en: string;
  tag: string;
  aspect_ratio: string;
  sort_order: string;
  display_from: string;
  display_until: string;
  url: string;
};

function dateInputValue(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function toInspirationEditDraft(item: InspirationAsset): InspirationEditDraft {
  return {
    title: item.title ?? '',
    title_en: item.title_en ?? '',
    tag: item.tag ?? 'albumy',
    aspect_ratio: item.aspect_ratio ?? '4/3',
    sort_order: String(item.sort_order ?? 100),
    display_from: dateInputValue(item.display_from),
    display_until: dateInputValue(item.display_until),
    url: item.url ?? '',
  };
}

function formatMbValue(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(2)} MB`;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

// StatCard

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }>;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div style={{
      background: 'var(--color-black-card)',
      border: '1px solid var(--glass-border)',
      borderRadius: '14px', padding: '1.25rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: '1rem',
    }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '10px',
        background: `${color}18`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-cream)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-gray-muted)', marginTop: '0.2rem' }}>{label}</div>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: Draft['source'] }) {
  const config = {
    manual: { label: 'Recznie', color: '#6b7280', icon: PenLine },
    ai_generated: { label: 'AI', color: '#8b5cf6', icon: Sparkles },
    pim_trigger: { label: 'PIM', color: '#f59e0b', icon: Package },
  }[source];
  const Icon = config.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.6rem', borderRadius: '100px',
      background: `${config.color}18`, border: `1px solid ${config.color}30`,
      fontSize: '0.7rem', color: config.color, fontWeight: 600,
    }}>
      <Icon size={10} /> {config.label}
    </span>
  );
}

function StatusDraftBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: '#6b7280' },
    scheduled: { label: 'Zaplanowany', color: '#f59e0b' },
    published: { label: 'Opublikowany', color: '#10b981' },
    archived: { label: 'Archiwum', color: '#374151' },
  };
  const config = cfg[status] ?? cfg.draft;
  return (
    <span style={{
      padding: '0.2rem 0.6rem', borderRadius: '100px',
      background: `${config.color}18`,
      fontSize: '0.7rem', color: config.color, fontWeight: 600,
    }}>
      {config.label}
    </span>
  );
}

function TopicStatusBadge({ status }: { status: Topic['status'] }) {
  const cfg = {
    pending: { label: 'Oczekuje', color: '#6b7280' },
    approved: { label: 'Zatwierdzony', color: '#3b82f6' },
    rejected: { label: 'Odrzucony', color: '#ef4444' },
    generated: { label: 'Wygenerowany', color: '#10b981' },
  }[status];
  return (
    <span style={{
      padding: '0.2rem 0.6rem', borderRadius: '100px',
      background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`,
      fontSize: '0.7rem', color: cfg.color, fontWeight: 600,
    }}>
      {cfg.label}
    </span>
  );
}

// AI Generator Panel

function AIGeneratorPanel({ onGenerated }: { onGenerated: (draft: Draft) => void }) {
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('Albumy');
  const [articleKind, setArticleKind] = useState<'product' | 'guide'>('guide');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<{ title_pl: string; category: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetch('/api/ai/generate-article')
      .then(r => r.json())
      .then(d => setSuggestions(d.suggestions ?? []))
      .catch(() => { });
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) { setError('Wpisz temat artykułu'); return; }
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/ai/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'topic',
          titlePl: topic,
          category,
          articleKind,
          saveAsDraft: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onGenerated({
          id: data.id ?? String(Date.now()),
          slug: data.article.slug,
          title_pl: data.article.title_pl,
          category: data.article.category,
          cover_image: data.article.cover_image ?? null,
          status: 'draft',
          source: 'ai_generated',
          created_at: new Date().toISOString().slice(0, 10),
        });
        setTopic('');
      } else {
        setError(data.message ?? 'Błąd generowania');
      }
    } catch {
      setError('Połączenie z AI nieudane');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(212,168,83,0.06) 100%)',
      border: '1px solid rgba(139,92,246,0.25)',
      borderRadius: '16px', padding: '1.75rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Sparkles size={18} color="#8b5cf6" />
        <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Generator AI</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="Wpisz temat artykułu..."
            className="newsletter-input"
            style={{ flex: 1 }}
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{
              background: 'var(--color-black-card)', border: '1px solid var(--glass-border)',
              borderRadius: '10px', padding: '0 0.875rem',
              color: 'var(--color-cream)', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: '0.875rem',
            }}
          >
            {['Albumy', 'Ramki', 'Media', 'KODAK', 'Trendy', 'Poradniki', 'Inne'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={articleKind}
            onChange={e => setArticleKind(e.target.value as 'product' | 'guide')}
            style={{
              background: 'var(--color-black-card)', border: '1px solid var(--glass-border)',
              borderRadius: '10px', padding: '0 0.875rem',
              color: 'var(--color-cream)', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: '0.875rem',
            }}
          >
            <option value="guide">Poradnik/Inspiracja (Pexels)</option>
            <option value="product">Produktowy (B2B)</option>
          </select>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#ef4444', fontSize: '0.82rem' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={handleGenerate} disabled={generating} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.25rem', borderRadius: '10px',
            background: generating ? 'rgba(139,92,246,0.3)' : '#8b5cf6',
            color: 'white', border: 'none', cursor: generating ? 'default' : 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.875rem',
          }}>
            {generating
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generuje...</>
              : <><Zap size={14} /> Generuj artykuł</>}
          </button>
          <button onClick={() => setShowSuggestions(!showSuggestions)} style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.65rem 1rem', borderRadius: '10px',
            background: 'transparent', border: '1px solid var(--glass-border)',
            color: 'var(--color-gray-muted)', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: '0.825rem',
          }}>
            <TrendingUp size={13} /> Sugestie
            {showSuggestions ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>

        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-muted)' }}>Kliknij aby uzyc tematu:</p>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => { setTopic(s.title_pl); setCategory(s.category); }} style={{
                    textAlign: 'left', padding: '0.625rem 0.875rem',
                    background: 'var(--color-black-card)', border: '1px solid var(--glass-border)',
                    borderRadius: '8px', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: '0.825rem', color: 'var(--color-cream)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#8b5cf6')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
                  >
                    <span style={{ color: '#8b5cf6', marginRight: '0.5rem', fontSize: '0.72rem', fontWeight: 600 }}>{s.category}</span>
                    {s.title_pl}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Manual Article Panel

function ManualArticlePanel({ onCreated }: { onCreated: (draft: Draft) => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Inne');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Podaj tytuł artykułu');
      return;
    }
    if (!content.trim()) {
      setError('Dodaj treść artykułu');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_pl: title.trim(),
          category,
          excerpt_pl: excerpt.trim(),
          content_text: content.trim(),
          tags,
          cover_image: coverImage.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.article) {
        setError(data.error ?? 'Błąd zapisu artykułu');
        return;
      }

      onCreated({
        id: data.article.id,
        slug: data.article.slug,
        title_pl: data.article.title_pl,
        category: data.article.category,
        cover_image: data.article.cover_image ?? null,
        status: data.article.status ?? 'draft',
        source: data.article.source ?? 'manual',
        created_at: data.article.created_at ?? new Date().toISOString(),
      });

      setTitle('');
      setCategory('Inne');
      setExcerpt('');
      setContent('');
      setTags('');
      setCoverImage('');
    } catch {
      setError('Błąd połączenia z API');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(212,168,83,0.06) 100%)',
      border: '1px solid rgba(16,185,129,0.25)',
      borderRadius: '16px', padding: '1.75rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <PenLine size={18} color="#10b981" />
        <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Własny artykuł</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł artykułu"
            className="newsletter-input"
            style={{ flex: '2 1 320px' }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              background: 'var(--color-black-card)', border: '1px solid var(--glass-border)',
              borderRadius: '10px', padding: '0 0.875rem',
              color: 'var(--color-cream)', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: '0.875rem', minHeight: '44px',
            }}
          >
            {['Albumy', 'Ramki', 'Media', 'KODAK', 'Trendy', 'Poradniki', 'Inne'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <input
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Lead / krotki opis (opcjonalnie)"
          className="newsletter-input"
        />

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Treść artykułu (oddziel akapity pustymi liniami)"
          className="newsletter-input"
          rows={8}
          style={{ resize: 'vertical', paddingTop: '0.7rem', minHeight: '180px' }}
        />

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tagi po przecinku (np. album, poradnik)"
            className="newsletter-input"
            style={{ flex: '1 1 260px' }}
          />
          <input
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="Cover image URL (opcjonalnie)"
            className="newsletter-input"
            style={{ flex: '1 1 320px' }}
          />
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#ef4444', fontSize: '0.82rem' }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <button onClick={handleCreate} disabled={saving} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
          width: 'fit-content', padding: '0.65rem 1.15rem', borderRadius: '10px',
          background: saving ? 'rgba(16,185,129,0.3)' : '#10b981',
          color: 'white', border: 'none', cursor: saving ? 'default' : 'pointer',
          fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.875rem',
        }}>
          {saving
            ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Zapisuje...</>
            : <><Plus size={14} /> Zapisz jako draft</>}
        </button>
      </div>
    </div>
  );
}

const PAGE_SIZE = 100;

function TopicsPanel({ onNotify }: { onNotify: (msg: string) => void }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterPending, setFilterPending] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingMulti, setGeneratingMulti] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search - triggers server query
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // offset is passed explicitly - avoids stale-closure duplicate-key bugs
  const loadTopics = useCallback(async (reset: boolean, offset: number, q: string) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const statusParam = filterPending ? 'pending' : 'all';
      const qEnc = encodeURIComponent(q);

      if (reset) {
        const countRes = await fetch(`/api/admin/topics?status=${statusParam}&countOnly=true&q=${qEnc}`);
        const countData = await countRes.json();
        setTotalCount(countData.count ?? 0);
      }

      const res = await fetch(`/api/admin/topics?status=${statusParam}&limit=${PAGE_SIZE}&offset=${offset}&q=${qEnc}`);
      const rows: Topic[] = await res.json();

      if (reset) {
        setTopics(rows);
        setSelectedIds(new Set());
      } else {
        setTopics(prev => {
          const seen = new Set(prev.map(t => t.id));
          return [...prev, ...rows.filter(r => !seen.has(r.id))];
        });
      }
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      onNotify('Błąd ładowania tematów');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterPending, onNotify]);

  useEffect(() => { loadTopics(true, 0, search); }, [filterPending, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async (topic: Topic) => {
    setGeneratingId(topic.id);
    try {
      const res = await fetch('/api/ai/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'topic',
          titlePl: topic.title_pl,
          titleEn: topic.title_en,
          category: topic.category ?? 'Inne',
          keywords: topic.keywords,
          saveAsDraft: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetch('/api/admin/topics', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: topic.id, status: 'generated' }),
        });
        setTopics(prev => prev.map(t => t.id === topic.id
          ? {
              ...t,
              status: 'generated' as const,
              generated_article_slug: data.article?.slug,
              generated_article_id: data.id,
            }
          : t));
        onNotify(`✓ "${data.article?.title_pl}" zapisany jako draft`);
      } else {
        onNotify(`Błąd: ${data.message ?? data.error ?? 'Błąd generowania'}`);
      }
    } catch {
      onNotify('Błąd połączenia z AI');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleGenerateMulti = async () => {
    const sel = topics.filter(t => selectedIds.has(t.id) && t.status === 'pending');
    if (sel.length === 0) return;
    setGeneratingMulti(true);
    try {
      const res = await fetch('/api/ai/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'multi',
          topics: sel.map(t => ({ title_pl: t.title_pl, title_en: t.title_en, category: t.category, keywords: t.keywords })),
          saveAsDraft: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await Promise.all(sel.map(t =>
          fetch('/api/admin/topics', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: t.id, status: 'generated' }),
          })
        ));
        setTopics(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, status: 'generated' as const } : t));
        setSelectedIds(new Set());
        onNotify(`✓ Artykuł z ${sel.length} tematów wygenerowany!`);
      } else {
        onNotify(`Błąd: ${data.message ?? data.error ?? 'Błąd generowania'}`);
      }
    } catch {
      onNotify('Błąd połączenia z AI');
    } finally {
      setGeneratingMulti(false);
    }
  };

  const handleReject = async (topicId: string) => {
    await fetch('/api/admin/topics', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: topicId, status: 'rejected' }),
    });
    setTopics(prev => prev.filter(t => t.id !== topicId));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(topicId); return n; });
    setTotalCount(c => c - 1);
    onNotify('Temat odrzucony');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const pendingVisible = topics.filter(t => t.status === 'pending');
  const allVisibleSelected = pendingVisible.length > 0 && pendingVisible.every(t => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingVisible.map(t => t.id)));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: selectedIds.size > 0 ? '5rem' : 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Tematy do Artykułów</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-muted)', marginTop: '0.25rem' }}>
            {totalCount} {filterPending ? 'oczekujących' : 'łącznie'} · pokazano {topics.length} · z PIM sync
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setFilterPending(f => !f)} style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.5rem 0.875rem', borderRadius: '8px', fontSize: '0.8rem',
            background: filterPending ? 'rgba(212,168,83,0.15)' : 'var(--glass-bg)',
            border: `1px solid ${filterPending ? 'var(--color-gold)' : 'var(--glass-border)'}`,
            color: filterPending ? 'var(--color-gold)' : 'var(--color-gray-muted)',
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            <Filter size={12} /> {filterPending ? 'Oczekujące' : 'Wszystkie'}
          </button>
          <button onClick={() => loadTopics(true, 0, search)} style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.5rem 0.875rem', borderRadius: '8px', fontSize: '0.8rem',
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            color: 'var(--color-gray-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            <RefreshCw size={12} /> Odśwież
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{
          position: 'absolute', left: '0.875rem', top: '50%',
          transform: 'translateY(-50%)', color: 'var(--color-gray-muted)', pointerEvents: 'none',
        }} />
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Szukaj tematów po nazwie..."
          className="newsletter-input"
          style={{ width: '100%', paddingLeft: '2.375rem', boxSizing: 'border-box' }}
        />
        {searchInput && (
          <button onClick={() => setSearchInput('')} style={{
            position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: 'var(--color-gray-muted)',
            cursor: 'pointer', padding: '0.2rem', lineHeight: 1,
          }}>×</button>
        )}
      </div>

      {/* Select all / count bar */}
      {!loading && pendingVisible.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={toggleSelectAll} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem',
            background: allVisibleSelected ? 'rgba(139,92,246,0.12)' : 'var(--glass-bg)',
            border: `1px solid ${allVisibleSelected ? 'rgba(139,92,246,0.45)' : 'var(--glass-border)'}`,
            color: allVisibleSelected ? '#8b5cf6' : 'var(--color-gray-muted)',
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            {allVisibleSelected
              ? <CheckCircle size={13} color="#8b5cf6" />
              : <Square size={13} />}
            {allVisibleSelected ? 'Odznacz wszystkie' : `Zaznacz wszystkie (${pendingVisible.length})`}
          </button>
          {selectedIds.size > 0 && (
            <span style={{ fontSize: '0.78rem', color: '#8b5cf6', fontWeight: 600 }}>
              {selectedIds.size} zaznaczonych
            </span>
          )}
        </div>
      )}

      {/* Topic list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-muted)' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', display: 'block' }} />
          <p>Ładowanie tematów...</p>
        </div>
      ) : topics.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-muted)' }}>
          <Lightbulb size={40} style={{ margin: '0 auto 1rem', opacity: 0.4, display: 'block' }} />
          <p>{search ? `Brak wyników dla „${search}”` : 'Brak tematów. Uruchom PIM sync.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {topics.map(topic => {
            const isSelected = selectedIds.has(topic.id);
            const isGenerating = generatingId === topic.id;
            return (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  background: isSelected ? 'rgba(139,92,246,0.07)' : 'var(--color-black-card)',
                  border: `1px solid ${isSelected ? 'rgba(139,92,246,0.4)' : 'var(--glass-border)'}`,
                  borderRadius: '12px', padding: '0.875rem 1.125rem',
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  transition: 'background 0.12s, border-color 0.12s',
                }}
              >
                {/* Checkbox */}
                {topic.status === 'pending' && (
                  <button
                    onClick={() => toggleSelect(topic.id)}
                    style={{
                      width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                      border: `2px solid ${isSelected ? '#8b5cf6' : 'var(--color-gray-muted)'}`,
                      background: isSelected ? '#8b5cf6' : 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s', padding: 0,
                    }}
                  >
                    {isSelected && (
                      <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                        <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <TopicStatusBadge status={topic.status} />
                    {topic.category && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-gold)', fontWeight: 600 }}>{topic.category}</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '0.875rem', color: 'var(--color-cream)', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {topic.title_pl}
                  </div>
                  {topic.keywords && topic.keywords.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {topic.keywords.slice(0, 4).map((kw, i) => (
                        <span key={i} style={{
                          fontSize: '0.67rem', color: 'var(--color-gray-muted)',
                          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                          borderRadius: '4px', padding: '0.1rem 0.35rem',
                        }}>{kw}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {topic.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      onClick={() => handleGenerate(topic)}
                      disabled={isGenerating || generatingMulti}
                      title="Generuj artykuł z tego tematu"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.76rem',
                        background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)',
                        color: '#8b5cf6', cursor: (isGenerating || generatingMulti) ? 'default' : 'pointer',
                        fontFamily: 'var(--font-body)', fontWeight: 600,
                        opacity: generatingMulti && !isGenerating ? 0.45 : 1,
                      }}
                    >
                      {isGenerating
                        ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Generuje</>
                        : <><Zap size={11} /> Generuj</>}
                    </button>
                    <button onClick={() => handleReject(topic.id)} title="Odrzuć temat" style={{
                      padding: '0.4rem', borderRadius: '8px',
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                {topic.status === 'generated' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {topic.generated_article_slug && (
                      <a
                        href={`/blog/${topic.generated_article_slug}?preview=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.76rem',
                          background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.35)',
                          color: 'var(--color-gold)', textDecoration: 'none', fontWeight: 600,
                        }}
                      >
                        Podgląd <ArrowRight size={11} />
                      </a>
                    )}
                    <CheckCircle size={17} color="#10b981" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.25rem' }}>
          <button
            onClick={() => loadTopics(false, topics.length, search)}
            disabled={loadingMore}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.5rem', borderRadius: '10px', fontSize: '0.84rem',
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              color: 'var(--color-gray-muted)', cursor: loadingMore ? 'default' : 'pointer',
              fontFamily: 'var(--font-body)', fontWeight: 500,
            }}
          >
            {loadingMore
              ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Ładowanie...</>
              : <><ChevronDown size={13} /> Załaduj więcej ({Math.max(0, totalCount - topics.length)} pozostałych)</>}
          </button>
        </div>
      )}

      {/* Sticky multi-select action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 48 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed', bottom: '1.75rem', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(14,14,14,0.96)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(139,92,246,0.45)', borderRadius: '16px',
              padding: '0.875rem 1.5rem',
              display: 'flex', alignItems: 'center', gap: '1rem',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              zIndex: 200, whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: 'var(--color-cream)' }}>
              <span style={{ color: '#8b5cf6', fontWeight: 700 }}>{selectedIds.size}</span> tematów zaznaczonych
            </span>
            <button
              onClick={handleGenerateMulti}
              disabled={generatingMulti}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.25rem', borderRadius: '10px',
                background: generatingMulti ? 'rgba(139,92,246,0.45)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                color: 'white', border: 'none',
                cursor: generatingMulti ? 'default' : 'pointer',
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.875rem',
                boxShadow: generatingMulti ? 'none' : '0 4px 14px rgba(139,92,246,0.4)',
              }}
            >
              {generatingMulti
                ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generuje artykuł...</>
                : <><Sparkles size={14} /> Generuj 1 artykuł z {selectedIds.size} tematów</>}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                padding: '0.6rem 0.875rem', borderRadius: '10px',
                background: 'transparent', border: '1px solid var(--glass-border)',
                color: 'var(--color-gray-muted)', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '0.825rem',
              }}
            >
              Odznacz
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Article Products Panel

interface ArticleOption { id: string; title_pl: string; slug: string; }
interface ProductOption { id: string; sku: string; name: string; category?: string; }
interface LinkedProduct { article_id: string; product_id: string; position: number; products: ProductOption; }

function ArticleProductsPanel({ onNotify }: { onNotify: (msg: string) => void }) {
  const [articles, setArticles] = useState<ArticleOption[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<ArticleOption | null>(null);
  const [linked, setLinked] = useState<LinkedProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);

  // Ładuj artykuły przy mount
  useEffect(() => {
    fetch('/api/articles?limit=100&status=all')
      .then(r => r.json())
      .then(data => setArticles(
        (Array.isArray(data) ? data : []).map((a: any) => ({ id: a.id, title_pl: a.title, slug: a.slug }))
      ));
  }, []);

  // Ładuj powiązane produkty gdy wybrany artykuł
  const loadLinked = useCallback(async (articleId: string) => {
    setLoading(true);
    const res = await fetch(`/api/article-products?article_id=${articleId}`);
    const data = await res.json();
    setLinked(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const handleSelectArticle = (a: ArticleOption) => {
    setSelectedArticle(a);
    loadLinked(a.id);
    setProductSearch('');
    setSearchResults([]);
  };

  // Szukaj produktów po nazwie/SKU przez API (admin client, omija RLS)
  useEffect(() => {
    if (productSearch.length < 2) { return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/b2b/products-search?q=${encodeURIComponent(productSearch)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const handleAdd = async (product: ProductOption) => {
    if (!selectedArticle) return;
    const nextPos = linked.length + 1;
    const res = await fetch('/api/article-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: selectedArticle.id, product_id: product.id, position: nextPos }),
    });
    const data = await res.json();
    if (data.success) {
      onNotify(`Dodano: ${product.name}`);
      loadLinked(selectedArticle.id);
      setProductSearch('');
      setSearchResults([]);
    } else {
      onNotify(`Błąd: ${data.error}`);
    }
  };

  const handleRemove = async (productId: string, productName: string) => {
    if (!selectedArticle) return;
    await fetch(`/api/article-products?article_id=${selectedArticle.id}&product_id=${productId}`, { method: 'DELETE' });
    onNotify(`Usunięto: ${productName}`);
    loadLinked(selectedArticle.id);
  };

  const alreadyLinkedIds = new Set(linked.map(l => l.product_id));
  const visibleSearchResults = productSearch.length < 2 ? [] : searchResults;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Produkty w artykułach</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-muted)', marginTop: '0.25rem' }}>
          Przypisz produkty B2B do artykułów - pojawią się w sidebarze na stronie artykułu.
        </p>
      </div>

      {/* Wybór artykułu */}
      <div style={{ background: 'var(--color-black-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.25rem' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          1. Wybierz artykuł
        </p>
        <select
          value={selectedArticle?.id ?? ''}
          onChange={e => {
            const a = articles.find(x => x.id === e.target.value);
            if (a) handleSelectArticle(a);
          }}
          style={{
            width: '100%', background: 'var(--color-black)', border: '1px solid var(--glass-border)',
            borderRadius: '8px', padding: '0.65rem 1rem', color: 'var(--color-cream)',
            fontFamily: 'var(--font-body)', fontSize: '0.875rem', cursor: 'pointer',
          }}
        >
          <option value=''>— wybierz artykuł —</option>
          {articles.map(a => <option key={a.id} value={a.id}>{a.title_pl}</option>)}
        </select>
      </div>

      {selectedArticle && (
        <>
          {/* Wyszukiwarka produktów */}
          <div style={{ background: 'var(--color-black-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              2. Wyszukaj i dodaj produkt
            </p>
            <input
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Wpisz nazwę lub SKU produktu..."
              className="newsletter-input"
              style={{ width: '100%', marginBottom: '0.75rem' }}
            />
            {searching && <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-muted)' }}>Szukam...</p>}
            {visibleSearchResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {visibleSearchResults.map(p => {
                  const already = alreadyLinkedIds.has(p.id);
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.875rem',
                      padding: '0.625rem 0.875rem', borderRadius: '8px',
                      background: already ? 'rgba(16,185,129,0.06)' : 'var(--glass-bg)',
                      border: `1px solid ${already ? 'rgba(16,185,129,0.2)' : 'var(--glass-border)'}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-cream)', fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>SKU: {p.sku} {p.category ? `· ${p.category}` : ''}</div>
                      </div>
                      {already
                        ? <CheckCircle size={16} color="#10b981" />
                        : <button onClick={() => handleAdd(p)} style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem',
                            background: 'rgba(212,168,83,0.15)', border: '1px solid rgba(212,168,83,0.3)',
                            color: 'var(--color-gold)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600,
                          }}>
                            <Plus size={12} /> Dodaj
                          </button>
                      }
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lista powiązanych produktów */}
          <div style={{ background: 'var(--color-black-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Produkty w sidebarze artykułu ({linked.length})
            </p>
            {loading
              ? <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-muted)' }}>Ładowanie...</p>
              : linked.length === 0
              ? <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-muted)' }}>Brak przypisanych produktów. Wyszukaj i dodaj powyżej.</p>
              : linked.map((l, i) => (
                  <div key={l.product_id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.875rem',
                    padding: '0.75rem 0',
                    borderBottom: i < linked.length - 1 ? '1px solid var(--glass-border)' : 'none',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                      background: 'var(--color-gold-dim)', border: '1px solid rgba(212,168,83,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.72rem', color: 'var(--color-gold)', fontWeight: 700,
                    }}>{l.position}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-cream)', fontWeight: 500 }}>{l.products?.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>SKU: {l.products?.sku}</div>
                    </div>
                    <button onClick={() => handleRemove(l.product_id, l.products?.name ?? '')} style={{
                      padding: '0.35rem', borderRadius: '6px',
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
            }
          </div>
        </>
      )}
    </div>
  );
}

// Inspirations Panel

function InspirationsPanel({ onNotify }: { onNotify: (msg: string) => void }) {
  const [items, setItems] = useState<InspirationAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sourceUrls, setSourceUrls] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [autoFromB2B, setAutoFromB2B] = useState(true);
  const [title, setTitle] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [tag, setTag] = useState('albumy');
  const [aspectRatio, setAspectRatio] = useState('4/3');
  const [sortOrder, setSortOrder] = useState('100');
  const [displayFrom, setDisplayFrom] = useState(new Date().toISOString().slice(0, 10));
  const [displayUntil, setDisplayUntil] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [edits, setEdits] = useState<Record<string, InspirationEditDraft>>({});
  const [storageStats, setStorageStats] = useState<InspirationStorageStats | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/inspirations?limit=300&includeStats=1');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? 'Błąd ładowania inspiracji');
      }
      const rawItems = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      const statsFromApi = (!Array.isArray(data) && data?.storage) ? data.storage as InspirationStorageStats : null;
      setStorageStats(statsFromApi);

      const normalizedItems: InspirationAsset[] = rawItems.map((item: any) => ({
        id: item.id,
        title: item.title ?? null,
        title_en: item.title_en ?? null,
        tag: item.tag ?? 'albumy',
        storage_path: item.storage_path ?? null,
        url: item.url ?? null,
        display_from: item.display_from ?? new Date().toISOString(),
        display_until: item.display_until ?? null,
        is_active: Boolean(item.is_active),
        sort_order: Number(item.sort_order ?? 100),
        aspect_ratio: item.aspect_ratio ?? '4/3',
        linked_product_id: item.linked_product_id ?? null,
        created_at: item.created_at ?? new Date().toISOString(),
      }));

      setItems(normalizedItems);
      setEdits((prev) => {
        const next: Record<string, InspirationEditDraft> = {};
        for (const item of normalizedItems) {
          next[item.id] = prev[item.id] ?? toInspirationEditDraft(item);
        }
        return next;
      });
    } catch (error) {
      console.error(error);
      onNotify('Błąd ładowania galerii inspiracji');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleCopyUrl = async (url?: string | null) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      onNotify('Link skopiowany');
    } catch {
      onNotify('Nie udało się skopiować linku');
    }
  };

  const resetUploadForm = () => {
    setFiles([]);
    setSourceUrls('');
    setTitle('');
    setTitleEn('');
    setTag('albumy');
    setAspectRatio('4/3');
    setSortOrder('100');
    setDisplayFrom(new Date().toISOString().slice(0, 10));
    setDisplayUntil('');
    setIsActive(true);
    setFileInputKey((prev) => prev + 1);
  };

  const handleUpload = async () => {
    const trimmedSourceUrls = sourceUrls.trim();
    if (files.length === 0 && !trimmedSourceUrls) {
      onNotify('Wybierz pliki albo podaj linki URL do obrazów');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      for (const selectedFile of files) {
        formData.append('files', selectedFile);
      }
      if (trimmedSourceUrls) {
        formData.append('source_urls', trimmedSourceUrls);
      }
      formData.append('auto_from_b2b', String(autoFromB2B));
      formData.append('tag', tag);
      formData.append('aspect_ratio', aspectRatio);
      formData.append('sort_order', sortOrder);
      formData.append('display_from', displayFrom);
      formData.append('is_active', String(isActive));
      if (displayUntil.trim()) formData.append('display_until', displayUntil);
      if (title.trim()) formData.append('title', title.trim());
      if (titleEn.trim()) formData.append('title_en', titleEn.trim());

      const response = await fetch('/api/admin/inspirations', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok && response.status !== 207) {
        throw new Error(data?.error ?? 'Błąd uploadu');
      }

      const createdCount = Number(data?.createdCount ?? 0);
      const failedCount = Number(data?.failedCount ?? 0);
      if (createdCount > 0 && failedCount > 0) {
        onNotify(`Dodano ${createdCount} plików, nieudane: ${failedCount}`);
      } else if (createdCount > 0) {
        onNotify(`Dodano ${createdCount} plików`);
      } else {
        onNotify(data?.error ?? 'Upload zakończony bez zapisanych plików');
      }

      resetUploadForm();
      await loadItems();
    } catch (error) {
      console.error(error);
      onNotify(error instanceof Error ? error.message : 'Błąd uploadu');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: InspirationAsset) => {
    setDeletingId(item.id);
    try {
      const response = await fetch(`/api/admin/inspirations?id=${item.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Błąd usuwania');
      }

      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      onNotify('Zdjęcie usunięte');
    } catch (error) {
      console.error(error);
      onNotify(error instanceof Error ? error.message : 'Błąd usuwania');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (item: InspirationAsset) => {
    setTogglingId(item.id);
    try {
      const response = await fetch('/api/admin/inspirations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          is_active: !item.is_active,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Błąd zmiany statusu');
      }

      setItems((prev) => prev.map((entry) => (
        entry.id === item.id
          ? { ...entry, is_active: !item.is_active }
          : entry
      )));
      onNotify(item.is_active ? 'Zdjęcie ukryte' : 'Zdjęcie aktywowane');
    } catch (error) {
      console.error(error);
      onNotify(error instanceof Error ? error.message : 'Błąd zmiany statusu');
    } finally {
      setTogglingId(null);
    }
  };

  const updateEditField = (item: InspirationAsset, patch: Partial<InspirationEditDraft>) => {
    setEdits((prev) => ({
      ...prev,
      [item.id]: {
        ...(prev[item.id] ?? toInspirationEditDraft(item)),
        ...patch,
      },
    }));
  };

  const handleSaveItem = async (item: InspirationAsset) => {
    const draft = edits[item.id] ?? toInspirationEditDraft(item);
    const parsedSortOrder = Number(draft.sort_order);

    setSavingId(item.id);
    try {
      const response = await fetch('/api/admin/inspirations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          title: draft.title,
          title_en: draft.title_en,
          tag: draft.tag,
          aspect_ratio: draft.aspect_ratio,
          sort_order: Number.isFinite(parsedSortOrder) ? parsedSortOrder : item.sort_order,
          display_from: draft.display_from,
          display_until: draft.display_until || null,
          url: draft.url,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error ?? 'Błąd zapisu');
      }

      const updatedItem = data.item as InspirationAsset;
      setItems((prev) => prev.map((entry) => (
        entry.id === item.id
          ? {
              ...entry,
              ...updatedItem,
              sort_order: Number(updatedItem.sort_order ?? entry.sort_order),
            }
          : entry
      )));
      setEdits((prev) => ({
        ...prev,
        [item.id]: toInspirationEditDraft({
          ...item,
          ...updatedItem,
          sort_order: Number(updatedItem.sort_order ?? item.sort_order),
        }),
      }));
      onNotify('Zmiany zapisane');
    } catch (error) {
      console.error(error);
      onNotify(error instanceof Error ? error.message : 'Błąd zapisu');
    } finally {
      setSavingId(null);
    }
  };

  const activeCount = items.filter((item) => item.is_active).length;
  const selectedCount = files.length;
  const sourceUrlCount = sourceUrls
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Inspiracje - upload i edycja</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-muted)', marginTop: '0.25rem' }}>
            Wgrywanie masowe, auto-uzupelnianie po SKU z B2B i edycja opublikowanych pozycji.
          </p>
        </div>
        <button
          onClick={loadItems}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 0.95rem',
            borderRadius: '10px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--color-gray-muted)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: '0.8rem',
          }}
        >
          <RefreshCw size={13} /> Odswiez
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '0.75rem' }}>
        <StatCard icon={ImageIcon} label="Wszystkie zdjęcia" value={items.length} color="var(--color-gold)" />
        <StatCard icon={Eye} label="Aktywne" value={activeCount} color="#10b981" />
        <StatCard icon={EyeOff} label="Ukryte" value={items.length - activeCount} color="#6b7280" />
        <StatCard icon={Upload} label="Wybrane pliki" value={selectedCount} color="#3b82f6" />
        <StatCard icon={Link2} label="Linki URL" value={sourceUrlCount} color="#06b6d4" />
        <StatCard icon={Package} label="Storage zajęte" value={formatMbValue(storageStats?.usedMb)} color="#f59e0b" />
        <StatCard icon={BarChart3} label="Storage wolne" value={formatMbValue(storageStats?.remainingMb)} color="#8b5cf6" />
      </div>

      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-gray-muted)' }}>
        {storageStats?.error
          ? `Storage stats: ${storageStats.error}`
          : storageStats?.quotaMb == null
            ? 'Storage stats: ustaw INSPIRATIONS_BUCKET_QUOTA_MB lub INSPIRATIONS_BUCKET_QUOTA_BYTES w .env, aby liczyć "pozostało".'
            : `Bucket: ${storageStats.bucket}, pliki: ${storageStats.filesCount}, wykorzystanie: ${storageStats.usagePercent ?? 'n/a'}%`}
        {storageStats?.truncated ? ' (scan truncated - zwiększ INSPIRATIONS_STORAGE_SCAN_MAX_ITEMS)' : ''}
      </p>

      <div style={{
        background: 'var(--color-black-card)',
        border: '1px solid var(--glass-border)',
        borderRadius: '14px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.65rem' }}>
          <input
            key={fileInputKey}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/avif"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            style={{
              background: 'var(--color-black)',
              border: '1px solid var(--glass-border)',
              borderRadius: '10px',
              color: 'var(--color-cream)',
              padding: '0.45rem 0.6rem',
              fontFamily: 'var(--font-body)',
              fontSize: '0.8rem',
            }}
          />
          <textarea
            value={sourceUrls}
            onChange={(event) => setSourceUrls(event.target.value)}
            placeholder={"Linki URL (1 w linii), np.\nhttps://www.b2b.gedeonpolska.com/zasoby/import/s/sbc46800art194_1.jpg"}
            style={{
              minHeight: '86px',
              resize: 'vertical',
              background: 'var(--color-black)',
              border: '1px solid var(--glass-border)',
              borderRadius: '10px',
              color: 'var(--color-cream)',
              padding: '0.65rem 0.75rem',
              fontFamily: 'var(--font-body)',
              fontSize: '0.8rem',
            }}
          />
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
                placeholder="Tytuł PL (opcjonalnie)"
            className="newsletter-input"
          />
          <input
            value={titleEn}
            onChange={(event) => setTitleEn(event.target.value)}
                placeholder="Tytuł EN (opcjonalnie)"
            className="newsletter-input"
          />
          <select
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            style={{
              background: 'var(--color-black)',
              border: '1px solid var(--glass-border)',
              borderRadius: '10px',
              color: 'var(--color-cream)',
              padding: '0 0.75rem',
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
            }}
          >
            {INSPIRATION_TAGS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select
            value={aspectRatio}
            onChange={(event) => setAspectRatio(event.target.value)}
            style={{
              background: 'var(--color-black)',
              border: '1px solid var(--glass-border)',
              borderRadius: '10px',
              color: 'var(--color-cream)',
              padding: '0 0.75rem',
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
            }}
          >
            {INSPIRATION_RATIOS.map((ratioValue) => (
              <option key={ratioValue} value={ratioValue}>{ratioValue}</option>
            ))}
          </select>
          <input
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            placeholder="Sort order (np. 100)"
            className="newsletter-input"
            inputMode="numeric"
          />
          <input
            type="date"
            value={displayFrom}
            onChange={(event) => setDisplayFrom(event.target.value)}
            className="newsletter-input"
          />
          <input
            type="date"
            value={displayUntil}
            onChange={(event) => setDisplayUntil(event.target.value)}
            className="newsletter-input"
          />
        </div>

        <label style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontSize: '0.82rem',
          color: 'var(--color-gray-muted)',
          width: 'fit-content',
        }}>
          <input
            type="checkbox"
            checked={autoFromB2B}
            onChange={(event) => setAutoFromB2B(event.target.checked)}
          />
          Auto B2B po nazwie pliku (SKU / SKU_1 ... SKU_15)
        </label>

        <label style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontSize: '0.82rem',
          color: 'var(--color-gray-muted)',
          width: 'fit-content',
        }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Aktywne od razu po dodaniu
        </label>

        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-gray-muted)' }}>
          Wybrane pliki: {selectedCount > 0 ? `${selectedCount} (upload masowy)` : 'brak'} · linki URL: {sourceUrlCount}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-muted)' }}>
            Zalecenie: min. 1600px szerokości, format JPG/WEBP. Auto B2B mapuje tytuły i kategorie po SKU.
          </p>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary"
            style={{ padding: '0.6rem 1rem', fontSize: '0.82rem' }}
          >
            <Upload size={13} />
            {uploading ? 'Wgrywanie...' : `Upload (${selectedCount + sourceUrlCount})`}
          </button>
        </div>
      </div>

      <div style={{
        background: 'var(--color-black-card)',
        border: '1px solid var(--glass-border)',
        borderRadius: '14px',
        padding: '1rem',
      }}>
        {loading ? (
          <p style={{ color: 'var(--color-gray-muted)', padding: '0.5rem' }}>Ładowanie zdjęć...</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--color-gray-muted)', padding: '0.5rem' }}>Brak zdjęć w galerii inspiracji.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.9rem' }}>
            {items.map((item) => (
              <div key={item.id} style={{
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.02)',
              }}>
                {item.url ? (
                  <img
                    src={item.url}
                    alt={item.title ?? item.tag}
                    style={{
                      width: '100%',
                      height: '160px',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div style={{ height: '160px', background: 'var(--color-black)', borderBottom: '1px solid var(--glass-border)' }} />
                )}
                <div style={{ padding: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.68rem',
                      borderRadius: '999px',
                      padding: '0.15rem 0.45rem',
                      color: item.is_active ? '#10b981' : 'var(--color-gray-muted)',
                      border: `1px solid ${item.is_active ? 'rgba(16,185,129,0.35)' : 'var(--glass-border)'}`,
                      background: item.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                    }}>
                      {item.is_active ? 'aktywne' : 'ukryte'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-gold)', fontWeight: 600 }}>
                      {item.tag}
                    </span>
                  </div>
                  <input
                    value={edits[item.id]?.title ?? item.title ?? ''}
                    onChange={(event) => updateEditField(item, { title: event.target.value })}
                      placeholder="Tytuł PL"
                    className="newsletter-input"
                    style={{ width: '100%' }}
                  />
                  <input
                    value={edits[item.id]?.title_en ?? item.title_en ?? ''}
                    onChange={(event) => updateEditField(item, { title_en: event.target.value })}
                      placeholder="Tytuł EN"
                    className="newsletter-input"
                    style={{ width: '100%' }}
                  />
                  <input
                    value={edits[item.id]?.url ?? item.url ?? ''}
                    onChange={(event) => updateEditField(item, { url: event.target.value })}
                    placeholder="URL obrazu"
                    className="newsletter-input"
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <select
                      value={edits[item.id]?.tag ?? item.tag}
                      onChange={(event) => updateEditField(item, { tag: event.target.value })}
                      style={{
                        background: 'var(--color-black)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        color: 'var(--color-cream)',
                        padding: '0 0.6rem',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.78rem',
                        minHeight: '36px',
                      }}
                    >
                      {INSPIRATION_TAGS.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <select
                      value={edits[item.id]?.aspect_ratio ?? item.aspect_ratio}
                      onChange={(event) => updateEditField(item, { aspect_ratio: event.target.value })}
                      style={{
                        background: 'var(--color-black)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        color: 'var(--color-cream)',
                        padding: '0 0.6rem',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.78rem',
                        minHeight: '36px',
                      }}
                    >
                      {(INSPIRATION_RATIOS.includes(edits[item.id]?.aspect_ratio ?? item.aspect_ratio)
                        ? INSPIRATION_RATIOS
                        : [edits[item.id]?.aspect_ratio ?? item.aspect_ratio, ...INSPIRATION_RATIOS]
                      ).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.45rem' }}>
                    <input
                      value={edits[item.id]?.sort_order ?? String(item.sort_order)}
                      onChange={(event) => updateEditField(item, { sort_order: event.target.value })}
                      placeholder="Sort"
                      className="newsletter-input"
                      inputMode="numeric"
                    />
                    <input
                      type="date"
                      value={edits[item.id]?.display_from ?? dateInputValue(item.display_from)}
                      onChange={(event) => updateEditField(item, { display_from: event.target.value })}
                      className="newsletter-input"
                    />
                    <input
                      type="date"
                      value={edits[item.id]?.display_until ?? dateInputValue(item.display_until)}
                      onChange={(event) => updateEditField(item, { display_until: event.target.value })}
                      className="newsletter-input"
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-gray-muted)' }}>
                    utworzono: {item.created_at?.slice(0, 10)}
                    {item.linked_product_id ? ` - product: ${item.linked_product_id}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleSaveItem(item)}
                      disabled={savingId === item.id}
                      style={{
                        padding: '0.35rem 0.55rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(212,168,83,0.35)',
                        background: 'rgba(212,168,83,0.12)',
                        color: 'var(--color-gold)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      {savingId === item.id ? 'Zapisywanie...' : 'Zapisz'}
                    </button>
                    <button
                      onClick={() => handleToggleActive(item)}
                      disabled={togglingId === item.id}
                      style={{
                        padding: '0.35rem 0.55rem',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'var(--color-gray-muted)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      {item.is_active ? <EyeOff size={12} /> : <Eye size={12} />}
                      {item.is_active ? 'Ukryj' : 'Pokaż'}
                    </button>
                    <button
                      onClick={() => handleCopyUrl(item.url)}
                      style={{
                        padding: '0.35rem 0.55rem',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'var(--color-gray-muted)',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Copy size={12} /> Kopiuj URL
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      style={{
                        padding: '0.35rem 0.55rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(239,68,68,0.2)',
                        background: 'rgba(239,68,68,0.1)',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Trash2 size={12} /> Usun
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [publishedArticles, setPublishedArticles] = useState<Draft[]>([]);
  const [coverImageInputs, setCoverImageInputs] = useState<Record<string, string>>({});
  const [titleInputs, setTitleInputs] = useState<Record<string, string>>({});
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [excerptInputs, setExcerptInputs] = useState<Record<string, string>>({});
  const [savingCoverImageId, setSavingCoverImageId] = useState<string | null>(null);
  const [savingArticleMetaId, setSavingArticleMetaId] = useState<string | null>(null);
  const [settingFeaturedArticleId, setSettingFeaturedArticleId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ drafts: 0, published: 0, scheduled: 0, subscribers: 0, topics: 0 });
  const [activeTab, setActiveTab] = useState<'overview' | 'drafts' | 'published' | 'topics' | 'schedule' | 'b2b' | 'products' | 'inspirations' | 'newsletter'>('drafts');
  const [notification, setNotification] = useState('');
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  const loadData = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const [
        articlesRes,
        topicCountRes,
        subscribersRes,
      ] = await Promise.all([
        fetchJsonWithTimeout<any[]>('/api/articles?limit=50&status=all'),
        fetchJsonWithTimeout<{ count?: number }>('/api/admin/topics?status=pending&countOnly=true'),
        fetchJsonWithTimeout<any[]>('/api/newsletter/contacts'),
      ]);

      const allArticles: Draft[] = (Array.isArray(articlesRes) ? articlesRes : [])
        .map((a: any) => {
          const tags = Array.isArray(a.tags) ? a.tags : [];
          return {
            id: a.id,
            slug: a.slug,
            title_pl: a.title ?? a.title_pl ?? '',
            excerpt_pl: a.excerpt ?? a.excerpt_pl ?? '',
            category: a.category ?? '',
            tags,
            is_home_featured: hasHomeFeaturedTag(tags),
            cover_image: a.cover_image ?? a.image ?? null,
            status: a.status,
            source: a.source ?? 'manual',
            created_at: a.publishedAt ?? a.created_at ?? '',
            scheduled_for: a.scheduled_for,
            views: a.views,
          };
        });

      const draftAndScheduled = allArticles.filter((a) => a.status === 'draft' || a.status === 'scheduled');
      const published = allArticles.filter((a) => a.status === 'published');

      setDrafts(draftAndScheduled);
      setPublishedArticles(published);
      setCoverImageInputs(
        Object.fromEntries(allArticles.map((article) => [article.id, article.cover_image ?? ''])),
      );
      setTitleInputs(
        Object.fromEntries(allArticles.map((article) => [article.id, article.title_pl ?? ''])),
      );
      setCategoryInputs(
        Object.fromEntries(allArticles.map((article) => [article.id, article.category ?? 'Inne'])),
      );
      setExcerptInputs(
        Object.fromEntries(allArticles.map((article) => [article.id, article.excerpt_pl ?? ''])),
      );

      const publishedCount = published.length;
      const scheduledCount = draftAndScheduled.filter((a: Draft) => a.status === 'scheduled').length;
      const subscribersCount = Array.isArray(subscribersRes) ? subscribersRes.length : 0;

      setStats({
        drafts: draftAndScheduled.filter((a: Draft) => a.status === 'draft').length,
        published: publishedCount,
        scheduled: scheduledCount,
        subscribers: subscribersCount,
        topics: topicCountRes?.count ?? 0,
      });
    } catch {
      showNotification('Błąd ładowania danych');
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDraftCreated = (draft: Draft, notificationMessage: string) => {
    setDrafts(prev => [draft, ...prev]);
    setCoverImageInputs(prev => ({ ...prev, [draft.id]: draft.cover_image ?? '' }));
    setTitleInputs(prev => ({ ...prev, [draft.id]: draft.title_pl ?? '' }));
    setCategoryInputs(prev => ({ ...prev, [draft.id]: draft.category ?? 'Inne' }));
    setExcerptInputs(prev => ({ ...prev, [draft.id]: draft.excerpt_pl ?? '' }));
    setStats(prev => ({ ...prev, drafts: prev.drafts + 1 }));
    showNotification(notificationMessage);
  };

  const handleGenerated = (draft: Draft) => {
    handleDraftCreated(draft, 'Artykuł wygenerowany i zapisany jako draft!');
  };

  const handleManualCreated = (draft: Draft) => {
    handleDraftCreated(draft, 'Artykuł zapisany jako draft.');
  };

  const handleDeleteArticle = async (article: Draft) => {
    const res = await fetch(`/api/admin/articles?id=${article.id}`, { method: 'DELETE' });
    if (res.ok) {
      setDrafts(prev => prev.filter(d => d.id !== article.id));
      setPublishedArticles(prev => prev.filter(d => d.id !== article.id));
      setCoverImageInputs(prev => {
        const next = { ...prev };
        delete next[article.id];
        return next;
      });
      setTitleInputs(prev => {
        const next = { ...prev };
        delete next[article.id];
        return next;
      });
      setCategoryInputs(prev => {
        const next = { ...prev };
        delete next[article.id];
        return next;
      });
      setExcerptInputs(prev => {
        const next = { ...prev };
        delete next[article.id];
        return next;
      });
      setStats(prev => ({
        ...prev,
        drafts: article.status === 'draft' ? Math.max(0, prev.drafts - 1) : prev.drafts,
        scheduled: article.status === 'scheduled' ? Math.max(0, prev.scheduled - 1) : prev.scheduled,
        published: article.status === 'published' ? Math.max(0, prev.published - 1) : prev.published,
      }));
      showNotification('Artykuł usunięty (zarchiwizowany)');
    } else {
      showNotification('Błąd usuwania artykułu');
    }
  };

  const handlePublish = async (id: string, draft: Draft) => {
    const res = await fetch('/api/admin/articles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'published', published_at: new Date().toISOString() }),
    });
    const data = await res.json();
    if (data.success) {
      setDrafts(prev => prev.filter(d => d.id !== id));
      setPublishedArticles(prev => ([
        {
          ...draft,
          tags: draft.tags ?? [],
          is_home_featured: hasHomeFeaturedTag(draft.tags),
          status: 'published',
          created_at: new Date().toISOString(),
        },
        ...prev.filter(item => item.id !== id),
      ]));
      setStats(prev => ({ ...prev, drafts: Math.max(0, prev.drafts - 1), published: prev.published + 1 }));
      showNotification(`✓ "${draft.title_pl}" opublikowany! Widoczny na /blog`);
    } else {
      showNotification(`Błąd publikacji: ${data.error ?? 'nieznany'}`);
    }
  };

  const handleSaveCoverImage = async (draft: Draft) => {
    setSavingCoverImageId(draft.id);
    try {
      const coverImage = (coverImageInputs[draft.id] ?? '').trim();
      const res = await fetch('/api/admin/articles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, cover_image: coverImage }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showNotification(`Błąd zapisu obrazka: ${data.error ?? 'nieznany'}`);
        return;
      }

      setDrafts(prev => prev.map(item => item.id === draft.id
        ? { ...item, cover_image: coverImage || null }
        : item));
      setPublishedArticles(prev => prev.map(item => item.id === draft.id
        ? { ...item, cover_image: coverImage || null }
        : item));
      showNotification('Cover image zapisany');
    } catch {
      showNotification('Błąd zapisu obrazka');
    } finally {
      setSavingCoverImageId(null);
    }
  };

  const handleSaveArticleMeta = async (article: Draft) => {
    setSavingArticleMetaId(article.id);
    try {
      const payload = {
        id: article.id,
        title_pl: (titleInputs[article.id] ?? article.title_pl ?? '').trim(),
        category: (categoryInputs[article.id] ?? article.category ?? 'Inne').trim() || 'Inne',
        excerpt_pl: (excerptInputs[article.id] ?? article.excerpt_pl ?? '').trim(),
        cover_image: (coverImageInputs[article.id] ?? article.cover_image ?? '').trim(),
      };

      if (!payload.title_pl) {
        showNotification('Tytuł artykułu nie może być pusty');
        return;
      }

      const res = await fetch('/api/admin/articles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showNotification(`Błąd zapisu artykułu: ${data.error ?? 'nieznany'}`);
        return;
      }

      setPublishedArticles(prev => prev.map((item) => item.id === article.id
        ? {
          ...item,
          title_pl: payload.title_pl,
          category: payload.category,
          excerpt_pl: payload.excerpt_pl,
          cover_image: payload.cover_image || null,
        }
        : item));
      setDrafts(prev => prev.map((item) => item.id === article.id
        ? {
          ...item,
          title_pl: payload.title_pl,
          category: payload.category,
          excerpt_pl: payload.excerpt_pl,
          cover_image: payload.cover_image || null,
        }
        : item));
      showNotification('Zmiany artykułu zapisane');
    } catch {
      showNotification('Błąd zapisu artykułu');
    } finally {
      setSavingArticleMetaId(null);
    }
  };

  const handleSetHomeFeatured = async (article: Draft) => {
    setSettingFeaturedArticleId(article.id);
    try {
      const res = await fetch('/api/admin/articles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: article.id,
          set_home_featured: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showNotification(`Błąd ustawiania polecanego artykułu: ${data.error ?? 'nieznany'}`);
        return;
      }

      setPublishedArticles((prev) => prev.map((item) => {
        const currentTags = Array.isArray(item.tags) ? item.tags : [];
        if (item.id === article.id) {
          return {
            ...item,
            tags: withHomeFeaturedTag(currentTags),
            is_home_featured: true,
          };
        }
        return {
          ...item,
          tags: withoutHomeFeaturedTag(currentTags),
          is_home_featured: false,
        };
      }));
      showNotification('Ustawiono polecany artykuł na stronie głównej');
    } catch {
      showNotification('Błąd ustawiania polecanego artykułu');
    } finally {
      setSettingFeaturedArticleId(null);
    }
  };

  const handleSync = async (autoDraft: boolean) => {
    setSyncing(true);
    showNotification('Uruchamiam PIM sync...');
    try {
      const url = `/api/admin/sync?autoDraft=${autoDraft}`;
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || 'Nieprawidłowa odpowiedź serwera' };
      }

      if (res.ok) {
        showNotification(`Sync: ${data.fetched} produktów, ${data.newProducts} nowych, ${data.topicsCreated} tematów, ${data.draftsCreated} draftów`);
        loadData();
      } else {
        showNotification(`Błąd sync: ${data.error ?? 'nieznany'}`);
      }
    } catch {
      showNotification('Błąd połączenia z sync API');
    } finally {
      setSyncing(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Przegląd', icon: BarChart3 },
    { id: 'drafts', label: `Drafty (${stats.drafts})`, icon: FileText },
    { id: 'published', label: `Opublikowane (${stats.published})`, icon: CheckCircle },
    { id: 'topics', label: `Tematy (${stats.topics})`, icon: Lightbulb },
    { id: 'schedule', label: 'Harmonogram', icon: Calendar },
    { id: 'b2b', label: 'B2B Sync', icon: Package },
    { id: 'products', label: 'Produkty', icon: Link2 },
    { id: 'inspirations', label: 'Inspiracje', icon: ImageIcon },
    { id: 'newsletter', label: 'Newsletter', icon: Mail },
  ] as const;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-black)', fontFamily: 'var(--font-body)' }}>

      {/* Top bar */}
      <div style={{
        background: 'var(--color-black-soft)',
        borderBottom: '1px solid var(--glass-border)',
        padding: '1rem 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="brand-logo-swap" style={{ height: '30px' }}>
            <Image
              src="/brand/gedeonwh_1.png"
              alt="Gedeon"
              width={186}
              height={48}
              className="brand-logo-dark"
              style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
              priority
            />
            <Image
              src="/brand/gedeon.png"
              alt="Gedeon"
              width={186}
              height={48}
              className="brand-logo-light"
              style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
              priority
            />
          </span>
          <div>
            <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-cream)' }}>Gedeon Blog Admin</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Panel zarzadzania contentem</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={loadData} style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.5rem 0.875rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            borderRadius: '8px', fontSize: '0.8rem', color: 'var(--color-gray-muted)', cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}>
            <RefreshCw size={13} /> Odswiez
          </button>
          <a href="/blog" target="_blank" className="btn-primary" style={{ padding: '0.5rem 0.875rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none' }}>
            Blog publiczny <ArrowRight size={13} />
          </a>
        </div>
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--color-black-card)', border: '1px solid rgba(212,168,83,0.4)',
              borderRadius: '10px', padding: '0.75rem 1.5rem',
              fontSize: '0.875rem', color: 'var(--color-cream)', zIndex: 500,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            }}
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.25rem', borderRadius: '8px 8px 0 0',
                border: `1px solid ${activeTab === tab.id ? 'var(--color-gold)' : 'transparent'}`,
                borderBottom: activeTab === tab.id ? '1px solid var(--color-black)' : '1px solid transparent',
                background: activeTab === tab.id ? 'var(--color-black)' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-gold)' : 'var(--color-gray-muted)',
                cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.875rem',
                fontWeight: activeTab === tab.id ? 600 : 400,
              }}>
                <Icon size={15} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '1rem' }}>
              <StatCard icon={FileText} label="Drafty" value={stats.drafts} color="#6b7280" />
              <StatCard icon={CheckCircle} label="Opublikowane" value={stats.published} color="#10b981" />
              <StatCard icon={Clock} label="Zaplanowane" value={stats.scheduled} color="#f59e0b" />
              <StatCard icon={Lightbulb} label="Tematy PIM" value={stats.topics} color="#8b5cf6" />
              <StatCard icon={Send} label="Subskrybenci" value={stats.subscribers} color="var(--color-gold)" />
            </div>

            <AIGeneratorPanel onGenerated={handleGenerated} />

            <div style={{ background: 'var(--color-black-card)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Ostatnie drafty</h3>
                <button onClick={() => setActiveTab('drafts')} style={{ fontSize: '0.78rem', color: 'var(--color-gold)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  Wszystkie &rarr;
                </button>
              </div>
              {loadingDrafts ? (
                <p style={{ color: 'var(--color-gray-muted)', fontSize: '0.875rem' }}>Ładowanie...</p>
              ) : drafts.slice(0, 3).map(draft => (
                <div key={draft.id} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.875rem 0', borderBottom: '1px solid var(--glass-border)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-cream)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {draft.title_pl}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                      <StatusDraftBadge status={draft.status} />
                      <SourceBadge source={draft.source} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-muted)', flexShrink: 0 }}>
                    {draft.created_at?.slice(0, 10)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drafts */}
        {activeTab === 'drafts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>Tworzenie artykułów</h2>
              <button onClick={() => setActiveTab('overview')} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.55rem 0.95rem', borderRadius: '10px',
                background: 'transparent', border: '1px solid var(--glass-border)',
                color: 'var(--color-gray-muted)', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '0.82rem',
              }}>
                <BarChart3 size={13} /> Przegląd
              </button>
            </div>

            <AIGeneratorPanel onGenerated={handleGenerated} />
            <ManualArticlePanel onCreated={handleManualCreated} />

            {loadingDrafts ? (
              <p style={{ color: 'var(--color-gray-muted)' }}>Ładowanie...</p>
            ) : drafts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-muted)' }}>
                <FileText size={40} style={{ margin: '0 auto 1rem', opacity: 0.4, display: 'block' }} />
                <p>Brak draftów. Wygeneruj artykuł przez AI!</p>
              </div>
            ) : drafts.map(draft => (
              <motion.div key={draft.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{
                background: 'var(--color-black-card)', border: '1px solid var(--glass-border)',
                borderRadius: '12px', padding: '1.25rem 1.5rem',
                display: 'flex', alignItems: 'flex-start', gap: '1.25rem',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                    <StatusDraftBadge status={draft.status} />
                    <SourceBadge source={draft.source} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-gold)', fontWeight: 600 }}>{draft.category}</span>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-cream)', marginBottom: '0.2rem' }}>
                    {draft.title_pl}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-muted)' }}>
                    Utworzono: {draft.created_at?.slice(0, 10)}
                    {draft.scheduled_for && ` · Zaplanowany: ${draft.scheduled_for.slice(0, 10)}`}
                  </div>
                  <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      value={coverImageInputs[draft.id] ?? ''}
                      onChange={(e) => setCoverImageInputs(prev => ({ ...prev, [draft.id]: e.target.value }))}
                      placeholder="Cover image URL"
                      className="newsletter-input"
                      style={{ flex: '1 1 360px', minWidth: '220px' }}
                    />
                    <button
                      onClick={() => handleSaveCoverImage(draft)}
                      disabled={savingCoverImageId === draft.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0.6rem 0.95rem', borderRadius: '10px',
                        background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.3)',
                        color: 'var(--color-gold)', cursor: savingCoverImageId === draft.id ? 'default' : 'pointer',
                        fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600,
                      }}
                    >
                      {savingCoverImageId === draft.id ? 'Zapisywanie...' : 'Zapisz obrazek'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <a
                    href={`/blog/${draft.slug ?? draft.id}?preview=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Podgląd draftu"
                    style={{
                      padding: '0.5rem', borderRadius: '8px',
                      background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.2)',
                      color: 'var(--color-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    <BookOpen size={14} />
                  </a>
                  <button onClick={() => handlePublish(draft.id, draft)} title="Opublikuj" style={{
                    padding: '0.5rem', borderRadius: '8px',
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                    color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  }}>
                    <Send size={14} />
                  </button>
                  <button onClick={() => handleDeleteArticle(draft)} title="Archiwizuj" style={{
                    padding: '0.5rem', borderRadius: '8px',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                    color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Published */}
        {activeTab === 'published' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                Opublikowane artykuły
              </h2>
              <button
                onClick={loadData}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.55rem 0.9rem', borderRadius: '10px',
                  background: 'transparent', border: '1px solid var(--glass-border)',
                  color: 'var(--color-gray-muted)', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', fontSize: '0.8rem',
                }}
              >
                <RefreshCw size={13} /> Odśwież
              </button>
            </div>

            {loadingDrafts ? (
              <p style={{ color: 'var(--color-gray-muted)' }}>Ładowanie...</p>
            ) : publishedArticles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-gray-muted)' }}>
                <CheckCircle size={38} style={{ margin: '0 auto 0.9rem', opacity: 0.45, display: 'block' }} />
                <p>Brak opublikowanych artykułów.</p>
              </div>
            ) : publishedArticles.map((article) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'var(--color-black-card)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '1rem 1.2rem',
                  display: 'grid',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <StatusDraftBadge status={article.status} />
                  <SourceBadge source={article.source} />
                  {article.is_home_featured && (
                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '999px',
                        background: 'rgba(212,168,83,0.18)',
                        border: '1px solid rgba(212,168,83,0.35)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--color-gold)',
                      }}
                    >
                      Polecany na stronie głównej
                    </span>
                  )}
                  <span style={{ fontSize: '0.73rem', color: 'var(--color-gray-muted)' }}>
                    {article.created_at?.slice(0, 10)}
                  </span>
                  {typeof article.views === 'number' && (
                    <span style={{ fontSize: '0.73rem', color: 'var(--color-gray-muted)' }}>
                      Odsłony: {article.views}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem' }}>
                  <label style={{ display: 'grid', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Tytuł</span>
                    <input
                      value={titleInputs[article.id] ?? article.title_pl ?? ''}
                      onChange={(e) => setTitleInputs(prev => ({ ...prev, [article.id]: e.target.value }))}
                      className="newsletter-input"
                    />
                  </label>

                  <label style={{ display: 'grid', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Kategoria</span>
                    <select
                      value={categoryInputs[article.id] ?? article.category ?? 'Inne'}
                      onChange={(e) => setCategoryInputs(prev => ({ ...prev, [article.id]: e.target.value }))}
                      className="newsletter-input"
                    >
                      {ARTICLE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Lead / Excerpt</span>
                  <textarea
                    rows={2}
                    value={excerptInputs[article.id] ?? article.excerpt_pl ?? ''}
                    onChange={(e) => setExcerptInputs(prev => ({ ...prev, [article.id]: e.target.value }))}
                    className="newsletter-input"
                    style={{ resize: 'vertical', paddingTop: '0.6rem', paddingBottom: '0.6rem' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-gray-muted)' }}>Cover image URL</span>
                  <input
                    value={coverImageInputs[article.id] ?? article.cover_image ?? ''}
                    onChange={(e) => setCoverImageInputs(prev => ({ ...prev, [article.id]: e.target.value }))}
                    className="newsletter-input"
                  />
                </label>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleSetHomeFeatured(article)}
                    disabled={settingFeaturedArticleId === article.id || article.is_home_featured}
                    className="btn-ghost"
                    style={{
                      padding: '0.5rem 0.85rem',
                      borderColor: 'rgba(212,168,83,0.35)',
                      color: article.is_home_featured ? 'var(--color-gold)' : 'var(--color-cream)',
                    }}
                  >
                    {settingFeaturedArticleId === article.id
                      ? 'Ustawiam...'
                      : article.is_home_featured
                        ? 'Polecany artykuł'
                        : 'Ustaw jako polecany'}
                  </button>

                  <button
                    onClick={() => handleSaveArticleMeta(article)}
                    disabled={savingArticleMetaId === article.id}
                    className="btn-primary"
                    style={{ padding: '0.5rem 0.85rem' }}
                  >
                    {savingArticleMetaId === article.id ? 'Zapisywanie...' : 'Zapisz zmiany'}
                  </button>

                  <a
                    href={`/blog/${article.slug ?? article.id}?preview=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost"
                    style={{ padding: '0.5rem 0.85rem', textDecoration: 'none' }}
                  >
                    Edytuj pełną treść
                  </a>

                  <button
                    onClick={() => handleDeleteArticle(article)}
                    className="btn-ghost"
                    style={{
                      padding: '0.5rem 0.85rem',
                      color: '#ef4444',
                      borderColor: 'rgba(239,68,68,0.3)',
                    }}
                  >
                    Usuń artykuł
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Topics */}
        {activeTab === 'topics' && <TopicsPanel onNotify={showNotification} />}

        {/* Schedule */}
        {activeTab === 'schedule' && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <Calendar size={56} color="var(--color-gold)" style={{ margin: '0 auto 1.5rem', opacity: 0.6, display: 'block' }} />
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Harmonogram Publikacji</h3>
            <p style={{ color: 'var(--color-gray-muted)', maxWidth: '400px', margin: '0 auto' }}>
              Kalendarz drag-and-drop bedzie dostepny w nastepnym etapie.
            </p>
          </div>
        )}

        {/* B2B */}
        {activeTab === 'b2b' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-body)', fontWeight: 600 }}>B2B PIM Sync</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-muted)', marginTop: '0.25rem' }}>
                  Vercel Cron: co godzine &middot; /api/b2b/sync
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={() => handleSync(false)} disabled={syncing} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.65rem 1.25rem', borderRadius: '10px', fontSize: '0.875rem',
                  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                  color: 'var(--color-cream)', cursor: syncing ? 'default' : 'pointer',
                  fontFamily: 'var(--font-body)', fontWeight: 600,
                }}>
                  <RefreshCw size={14} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
                  Sync produktów
                </button>
                <button onClick={() => handleSync(true)} disabled={syncing} className="btn-primary" style={{ padding: '0.65rem 1.25rem', fontSize: '0.875rem' }}>
                  <Zap size={14} /> Sync + AI Draft
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--color-gold-dim)', border: '1px solid rgba(212,168,83,0.3)', borderRadius: '12px', padding: '1.25rem', display: 'flex', gap: '1rem' }}>
              <Package size={18} color="var(--color-gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-cream)', fontWeight: 500, marginBottom: '0.375rem' }}>
                  B2B XML Feed &middot; b2b.gedeonpolska.com
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-muted)' }}>
                  1850 produktów &middot; Ostatni sync: 2026-03-31 &middot; ~14s &middot; Gemini 2.0 Flash
                </p>
              </div>
            </div>


            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {[
                { title: 'Sync produktów', desc: 'Pobiera XML Feed, wykrywa nowe SKU (limit 10 000), zapisuje do pim_sync_log, generuje topic_suggestions.', color: '#6b7280', icon: RefreshCw },
                { title: 'Sync + AI Draft', desc: 'Jak powyżej, plus generuje 3 drafty przez Gemini 2.0 Flash dla nowych produktów (max 3/run, rate-limit safe).', color: '#8b5cf6', icon: Sparkles },
              ].map(({ title, desc, color, icon: Icon }) => (
                <div key={title} style={{ background: 'var(--color-black-card)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Icon size={15} color={color} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-cream)' }}>{title}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-gray-muted)', lineHeight: 1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Article Products */}
        {activeTab === 'products' && <ArticleProductsPanel onNotify={showNotification} />}

        {/* Inspirations */}
        {activeTab === 'inspirations' && <InspirationsPanel onNotify={showNotification} />}

        {/* Newsletter Iframe */}
        {activeTab === 'newsletter' && (
          <div style={{ background: 'var(--color-black-card)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
            <iframe 
              src="/newsletter/index.html" 
              style={{ width: '100%', height: 'calc(100vh - 200px)', border: 'none' }} 
              title="Newsletter Generator" 
            />
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}


