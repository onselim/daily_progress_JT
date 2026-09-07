import { useState } from 'react';
import { deleteAsset } from '../lib/deleteAsset';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface DeleteAssetDialogProps {
  assetId: string;
  assetCode: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteAssetDialog({ assetId, assetCode, onClose, onDeleted }: DeleteAssetDialogProps) {
  const { t } = useLanguage();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText === assetCode && !deleting;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAsset(assetId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('deleteAsset.title')}</h2>
        <p className="access-banner-sub">{t('deleteAsset.body', { code: assetCode })}</p>
        <label>
          {t('deleteAsset.typeToConfirm', { code: assetCode })}
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            className="modal-confirm-input"
          />
        </label>

        {error && <p className="form-message">{error}</p>}

        <div className="wizard-actions">
          <button type="button" onClick={onClose} className="wizard-secondary-btn">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleDelete} disabled={!canDelete} className="modal-danger-btn">
            {deleting ? t('common.deleting') : t('deleteAsset.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
