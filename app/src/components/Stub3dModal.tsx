import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../lib/i18n/LanguageContext';

/** Full-screen pop-up around the standalone 3D stub-setting page (public/stub-ayar). It is a same-origin iframe,
 * so the page shares the app language, and closing it (top-right X, Esc) leaves the report page exactly as it was --
 * no new browser tab, no navigation. */
export function Stub3dModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="stub3d-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <iframe className="stub3d-frame" src={url} title={title} allow="fullscreen" />
      <button type="button" className="stub3d-close" onClick={onClose} title={t('common.close')} aria-label={t('common.close')}>
        ×
      </button>
    </div>,
    document.body,
  );
}
