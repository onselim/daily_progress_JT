import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface AddAssetDialogProps {
  projectId: string;
  knownAssetTypes: string[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddAssetDialog({ projectId, knownAssetTypes, onClose, onAdded }: AddAssetDialogProps) {
  const { t } = useLanguage();
  const [assetCode, setAssetCode] = useState('');
  const [assetType, setAssetType] = useState('');
  const [station, setStation] = useState('');
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [z, setZ] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const code = assetCode.trim();
    if (!code) return;
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('assets').insert({
      project_id: projectId,
      asset_code: code,
      asset_type: assetType.trim() || null,
      station: station.trim() || null,
      x: x.trim() ? Number(x) : null,
      y: y.trim() ? Number(y) : null,
      z: z.trim() ? Number(z) : null,
    });

    setSaving(false);
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? t('assetEditor.codeInUse')
          : t('common.saveFailed', { message: insertError.message }),
      );
      return;
    }
    onAdded();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title-neutral">{t('addAsset.title')}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            {t('addAsset.towerCode')}
            <input
              value={assetCode}
              onChange={(e) => setAssetCode(e.target.value)}
              autoFocus
              required
              className="modal-confirm-input"
            />
          </label>
          <label>
            {t('common.type')}
            <input
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              list="known-asset-types"
              className="modal-confirm-input"
            />
            <datalist id="known-asset-types">
              {knownAssetTypes.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </label>
          <label>
            {t('common.station')}
            <input value={station} onChange={(e) => setStation(e.target.value)} className="modal-confirm-input" />
          </label>
          <div className="wizard-form-row">
            <label>
              X
              <input type="number" step="any" value={x} onChange={(e) => setX(e.target.value)} className="modal-confirm-input" />
            </label>
            <label>
              Y
              <input type="number" step="any" value={y} onChange={(e) => setY(e.target.value)} className="modal-confirm-input" />
            </label>
            <label>
              Z
              <input type="number" step="any" value={z} onChange={(e) => setZ(e.target.value)} className="modal-confirm-input" />
            </label>
          </div>

          {error && <p className="form-message">{error}</p>}

          <div className="wizard-actions">
            <button type="button" onClick={onClose} className="wizard-secondary-btn">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving || !assetCode.trim()}>
              {saving ? t('addAsset.adding') : t('addAsset.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
