/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Clock } from 'lucide-react';

interface Article {
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
}

export default function ArticleCard({ article, lang, index }: {
  article: Article;
  lang: 'pl' | 'en';
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      <Link href={`/blog/${article.slug}`} style={{ textDecoration: 'none' }}>
        <div className="article-card">
          {/* Cover */}
          <div className="article-card-image">
            <div style={{
              width: '100%', height: '100%',
              background: article.coverColor,
              minHeight: '200px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {article.coverImage && (
                <>
                  <div style={{
                    position: 'absolute',
                    inset: '-8%',
                    background: `url(${article.coverImage}) center / cover no-repeat`,
                    filter: 'blur(16px)',
                    opacity: 0.45,
                    transform: 'scale(1.06)',
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, var(--image-overlay-soft) 0%, var(--surface-overlay-soft) 100%)',
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: '0.75rem',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid rgba(212,168,83,0.22)',
                    background: 'var(--image-frame-bg)',
                    boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <img
                      src={article.coverImage}
                      alt={lang === 'pl' ? article.title : article.titleEn}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        objectPosition: 'center center',
                        display: 'block',
                      }}
                    />
                  </div>
                </>
              )}
              {!article.coverImage && (
                <>
                  {/* Decorative frames inside */}
                  <div style={{
                    width: '80px', height: '58px',
                    border: '2px solid rgba(212,168,83,0.5)',
                    borderRadius: '4px',
                    position: 'absolute',
                    transform: 'rotate(-6deg)',
                  }} />
                  <div style={{
                    width: '90px', height: '66px',
                    border: '1px solid rgba(212,168,83,0.2)',
                    borderRadius: '4px',
                    position: 'absolute',
                    transform: 'rotate(4deg)',
                  }} />
                </>
              )}
              <div className="badge" style={{
                position: 'absolute', top: '0.75rem', left: '0.75rem',
                fontSize: '0.7rem',
              }}>
                {lang === 'pl' ? article.category : article.categoryEn}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="article-card-body">
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              marginBottom: '0.75rem',
              fontSize: '0.78rem', color: 'var(--color-gray-muted)',
            }}>
              <span>{article.date}</span>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--color-gold)', flexShrink: 0 }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={11} />
                {article.readTime} {lang === 'pl' ? 'czyt.' : 'read'}
              </span>
            </div>

            <h4 style={{ marginBottom: '0.625rem', fontSize: '1.05rem', lineHeight: 1.3 }}>
              {lang === 'pl' ? article.title : article.titleEn}
            </h4>

            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              {lang === 'pl' ? article.excerpt : article.excerptEn}
            </p>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              color: 'var(--color-gold)', fontSize: '0.85rem', fontWeight: 600,
            }}>
              {lang === 'pl' ? 'Czytaj' : 'Read'}
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
