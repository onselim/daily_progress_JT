import { useLanguage } from '../lib/i18n/LanguageContext';

interface WindyPopupProps {
  lat: number;
  lng: number;
  label: string;
  onClose: () => void;
}

/** Corner-docked, closeable Windy.com embed (iframe, no API key needed — see CLAUDE.md
 * Section 2) centered on one tower's exact coordinates. */
export function WindyPopup({ lat, lng, label, onClose }: WindyPopupProps) {
  const { t } = useLanguage();
  const src =
    `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}` +
    `&detailLat=${lat}&detailLon=${lng}&width=650&height=450&zoom=11` +
    `&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true` +
    `&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default` +
    `&metricTemp=default&radarRange=-1`;

  return (
    <div className="windy-popup">
      <div className="windy-popup-header">
        <span>{t('assetEditor.windForecast')} — {label}</span>
        <button type="button" className="windy-popup-close" onClick={onClose} title={t('common.close')} aria-label={t('common.close')}>
          ×
        </button>
      </div>
      <iframe
        title={`Windy forecast for ${label}`}
        className="windy-popup-frame"
        src={src}
        frameBorder="0"
      />
    </div>
  );
}
