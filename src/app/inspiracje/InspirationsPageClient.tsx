'use client';

import { useDeferredValue, useMemo, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ExternalLink, Filter, LoaderCircle } from 'lucide-react';
import { MasonryPhotoAlbum, type Photo } from 'react-photo-album';
import Lightbox from 'yet-another-react-lightbox';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { type InspirationPhoto } from '@/lib/supabase';

type Lang = 'pl' | 'en';

type FilterItem = {
  id: string;
  label: string;
  labelEn: string;
};

interface GalleryPhoto extends Photo {
  key: string;
  id: string;
  tag: string;
  label: string;
  labelEn: string;
}

const FILTERS: FilterItem[] = [
  { id: 'all', label: 'Wszystkie', labelEn: 'All' },
  { id: 'albumy', label: 'Albumy', labelEn: 'Albums' },
  { id: 'ramki', label: 'Ramki', labelEn: 'Frames' },
  { id: 'media', label: 'Media', labelEn: 'Media' },
  { id: 'studio', label: 'Studio', labelEn: 'Studio' },
];

const PRODUCT_URL = 'https://www.b2b.gedeonpolska.com';

function parseAspectRatio(input?: string): { width: number; height: number } {
  const safe = (input ?? '4/3').trim().toLowerCase();
  const match = safe.match(/(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)/);

  if (!match) {
    return { width: 1200, height: 900 };
  }

  const ratioWidth = Number(match[1]);
  const ratioHeight = Number(match[2]);

  if (!Number.isFinite(ratioWidth) || !Number.isFinite(ratioHeight) || ratioWidth <= 0 || ratioHeight <= 0) {
    return { width: 1200, height: 900 };
  }

  const base = 1200;
  return {
    width: Math.round(base * ratioWidth),
    height: Math.round(base * ratioHeight),
  };
}

function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice('http://'.length)}`;
  }

  return trimmed;
}

function toGalleryPhoto(photo: InspirationPhoto): GalleryPhoto | null {
  const src = normalizeImageUrl(photo.url);
  if (!src) return null;

  const { width, height } = parseAspectRatio(photo.aspect_ratio);

  return {
    key: photo.id,
    id: photo.id,
    src,
    width,
    height,
    alt: photo.title ?? photo.tag,
    tag: photo.tag,
    label: photo.title ?? photo.tag,
    labelEn: photo.title_en ?? photo.title ?? photo.tag,
  };
}

export default function InspirationsPageClient({
  initialPhotos,
}: {
  initialPhotos: InspirationPhoto[];
}) {
  const [lang, setLang] = useState<Lang>('pl');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isFilterPending, startFilterTransition] = useTransition();
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [photos] = useState<GalleryPhoto[]>(
    () => initialPhotos.map(toGalleryPhoto).filter((item): item is GalleryPhoto => Boolean(item))
  );
  const loading = false;
  const deferredFilter = useDeferredValue(activeFilter);

  const filtered = useMemo(() => {
    if (deferredFilter === 'all') return photos;
    return photos.filter((photo) => photo.tag === deferredFilter);
  }, [deferredFilter, photos]);

  const clampedLightboxIndex =
    lightboxIndex >= 0 && lightboxIndex < filtered.length ? lightboxIndex : -1;
  const isLightboxOpen = clampedLightboxIndex >= 0;

  return (
    <>
      <Navbar lang={lang} onLangChange={setLang} />

      <main style={{ paddingTop: '80px' }}>
        <section
          style={{
            padding: 'clamp(4rem, 8vw, 7rem) 0 3rem',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.12) 0%, transparent 70%)',
          }}
        >
          <div className="container-site" style={{ textAlign: 'center' }}>
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
              <div className="badge" style={{ marginBottom: '1.25rem' }}>
                <Camera size={12} />
                {lang === 'pl' ? 'Galeria Inspiracji' : 'Inspiration Gallery'}
              </div>
              <h1 style={{ marginBottom: '1rem' }}>
                {lang === 'pl' ? (
                  <>
                    <span className="gradient-text-gold">Inspiracje</span> dla branży foto
                  </>
                ) : (
                  <>
                    <span className="gradient-text-gold">Inspiration</span> for the photo industry
                  </>
                )}
              </h1>
              <p style={{ maxWidth: '620px', margin: '0 auto', fontSize: '1.05rem' }}>
                {lang === 'pl'
                  ? 'Nowoczesna galeria produktów Gedeon. Automatyczny układ, różne proporcje i zbliżenie po otwarciu.'
                  : 'A modern gallery of Gedeon products. Automatic layout, mixed proportions, and deep zoom in lightbox.'}
              </p>
            </motion.div>
          </div>
        </section>

        <section style={{ padding: '0 0 2.2rem' }}>
          <div className="container-site">
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginRight: '0.5rem',
                  color: 'var(--color-gray-muted)',
                  flexShrink: 0,
                  fontSize: '0.8rem',
                }}
              >
                {isFilterPending ? <LoaderCircle size={15} className="spin-loader" /> : <Filter size={15} />}
                <span>{lang === 'pl' ? 'Filtruj:' : 'Filter:'}</span>
              </div>

              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => startFilterTransition(() => setActiveFilter(filter.id))}
                  style={{
                    padding: '0.45rem 1.1rem',
                    borderRadius: '100px',
                    border: `1px solid ${activeFilter === filter.id ? 'var(--color-gold)' : 'var(--glass-border)'}`,
                    background: activeFilter === filter.id ? 'var(--color-gold-dim)' : 'transparent',
                    color: activeFilter === filter.id ? 'var(--color-gold)' : 'var(--color-gray-muted)',
                    fontSize: '0.825rem',
                    fontWeight: activeFilter === filter.id ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                    fontFamily: 'var(--font-body)',
                  }}
                  aria-pressed={activeFilter === filter.id}
                >
                  {lang === 'pl' ? filter.label : filter.labelEn}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section style={{ paddingBottom: '5rem' }}>
          <div className="container-site">
            <AnimatePresence mode="wait">
              <motion.div
                key={deferredFilter}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                {loading ? (
                  <div className="inspirations-empty">
                    {lang === 'pl' ? 'Ładowanie galerii...' : 'Loading gallery...'}
                  </div>
                ) : null}

                {!loading && filtered.length === 0 ? (
                  <div className="inspirations-empty">
                    {lang === 'pl' ? 'Brak zdjęć dla wybranego filtra.' : 'No photos found for the selected filter.'}
                  </div>
                ) : null}

                {!loading && filtered.length > 0 ? (
                  <MasonryPhotoAlbum<GalleryPhoto>
                    photos={filtered}
                    defaultContainerWidth={1200}
                    columns={(containerWidth) => {
                      if (containerWidth < 700) return 1;
                      if (containerWidth < 1100) return 2;
                      return 3;
                    }}
                    spacing={(containerWidth) => (containerWidth < 700 ? 12 : 16)}
                    onClick={({ index }) => setLightboxIndex(index)}
                    componentsProps={{
                      container: { className: 'inspiration-album' },
                      wrapper: ({ photo }) => ({
                        className: `inspiration-item inspiration-tag-${photo.tag}`,
                      }),
                      button: ({ photo }) => ({
                        className: 'inspiration-item-button',
                        'aria-label': lang === 'pl' ? `Podgląd: ${photo.label}` : `Preview: ${photo.labelEn}`,
                      }),
                      image: { className: 'inspiration-item-image', loading: 'lazy', decoding: 'async' },
                    }}
                    render={{
                      extras: (_props, context) => {
                        const tagLabel = context.photo.tag.toUpperCase();
                        const title = lang === 'pl' ? context.photo.label : context.photo.labelEn;

                        return (
                          <div className="inspiration-item-overlay">
                            <span className="badge inspiration-item-badge">{tagLabel}</span>
                            <p className="inspiration-item-title">{title}</p>
                          </div>
                        );
                      },
                    }}
                  />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </main>

      <Lightbox
        open={isLightboxOpen}
        close={() => setLightboxIndex(-1)}
        index={clampedLightboxIndex < 0 ? 0 : clampedLightboxIndex}
        plugins={[Zoom, Thumbnails]}
        slides={filtered.map((photo) => ({
          src: photo.src,
          alt: lang === 'pl' ? photo.label : photo.labelEn,
          width: photo.width,
          height: photo.height,
        }))}
        carousel={{ finite: filtered.length <= 1, spacing: '12px', padding: '4px' }}
        thumbnails={{
          width: 96,
          height: 68,
          gap: 10,
          border: 0,
          borderRadius: 10,
          showToggle: false,
        }}
        zoom={{
          maxZoomPixelRatio: 2.5,
          zoomInMultiplier: 2,
          wheelZoomDistanceFactor: 120,
          doubleTapDelay: 280,
          doubleClickDelay: 280,
        }}
        on={{ view: ({ index }) => setLightboxIndex(index) }}
        render={{
          slideFooter: () => {
            const active = filtered[clampedLightboxIndex];
            if (!active) return null;
            const title = lang === 'pl' ? active.label : active.labelEn;

            return (
              <div className="inspiration-lightbox-footer">
                <div>
                  <p className="inspiration-lightbox-tag">{active.tag}</p>
                  <h3 className="inspiration-lightbox-title">{title}</h3>
                </div>
                <a
                  href={PRODUCT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inspiration-lightbox-link"
                >
                  {lang === 'pl' ? 'Platforma B2B' : 'B2B Platform'}
                  <ExternalLink size={14} />
                </a>
              </div>
            );
          },
        }}
      />

      <Footer lang={lang} />

      <style jsx global>{`
        .spin-loader {
          animation: spinLoader 1s linear infinite;
        }

        @keyframes spinLoader {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .inspiration-album {
          width: 100%;
        }

        .inspiration-item {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid var(--glass-border);
          background: var(--surface-card);
          transform: translateZ(0);
        }

        .inspiration-item::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: 16px;
          box-shadow: inset 0 0 0 1px rgba(212, 168, 83, 0.15);
        }

        .inspiration-item-button {
          all: unset;
          display: block;
          width: 100%;
          cursor: zoom-in;
          position: relative;
        }

        .inspiration-item-image {
          width: 100%;
          height: auto;
          display: block;
          transition: transform 0.45s var(--transition-smooth), filter 0.35s var(--transition-smooth);
          filter: saturate(0.95) contrast(1.03);
        }

        .inspiration-item:hover .inspiration-item-image {
          transform: scale(1.06);
          filter: saturate(1) contrast(1.06);
        }

        .inspiration-item-overlay {
          position: absolute;
          inset: auto 0 0 0;
          padding: 1rem 1rem 1.1rem;
          background: linear-gradient(to top, var(--surface-overlay) 0%, var(--surface-overlay-soft) 45%, transparent 100%);
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.3s ease, transform 0.3s ease;
          pointer-events: none;
        }

        .inspiration-item:hover .inspiration-item-overlay {
          opacity: 1;
          transform: translateY(0);
        }

        .inspiration-item-badge {
          font-size: 0.64rem;
          margin-bottom: 0.45rem;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        .inspiration-item-title {
          font-size: 0.85rem;
          color: var(--color-cream);
          font-weight: 500;
          margin: 0;
          line-height: 1.35;
          text-wrap: balance;
        }

        .inspiration-lightbox-footer {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: clamp(5.5rem, 14vh, 7.5rem);
          width: min(920px, calc(100vw - 2rem));
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.95rem 1rem;
          border-radius: 14px;
          border: 1px solid rgba(212, 168, 83, 0.3);
          background: var(--surface-overlay-soft);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .inspiration-lightbox-tag {
          font-size: 0.7rem;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--color-gold);
          margin: 0 0 0.2rem;
        }

        .inspiration-lightbox-title {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.05rem, 2.2vw, 1.45rem);
          line-height: 1.2;
          color: var(--color-cream);
          max-width: min(620px, 70vw);
        }

        .inspiration-lightbox-link {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          flex-shrink: 0;
          padding: 0.65rem 0.95rem;
          border-radius: 9px;
          border: 1px solid rgba(212, 168, 83, 0.35);
          color: var(--color-gold);
          font-size: 0.84rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .inspiration-lightbox-link:hover {
          background: var(--color-gold-dim);
          border-color: var(--color-gold);
        }

        .inspirations-empty {
          width: 100%;
          border: 1px dashed var(--glass-border);
          border-radius: 16px;
          background: rgba(245, 240, 232, 0.02);
          color: var(--color-gray-muted);
          text-align: center;
          padding: 2rem 1rem;
        }

        @media (max-width: 900px) {
          .inspiration-item-overlay {
            opacity: 1;
            transform: translateY(0);
            padding: 0.85rem 0.85rem 0.9rem;
          }
        }

        @media (max-width: 768px) {
          .inspiration-lightbox-footer {
            bottom: clamp(6.8rem, 12vh, 8rem);
            flex-direction: column;
            align-items: flex-start;
          }

          .inspiration-lightbox-title {
            max-width: 100%;
          }
        }
      `}</style>
    </>
  );
}

