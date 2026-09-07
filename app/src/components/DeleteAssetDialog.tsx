import { useState } from 'react';
import { deleteAsset } from '../lib/deleteAsset';

interface DeleteAssetDialogProps {
  assetId: string;
  assetCode: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteAssetDialog({ assetId, assetCode, onClose, onDeleted }: DeleteAssetDialogProps) {
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
        <h2 className="modal-title">Delete tower?</h2>
        <p className="access-banner-sub">
          This permanently deletes tower <strong>{assetCode}</strong> and everything attached to it — work-item
          status, daily logs, photos, and documents. This cannot be undone.
        </p>
        <label>
          Type <strong>{assetCode}</strong> to confirm
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
            Cancel
          </button>
          <button type="button" onClick={handleDelete} disabled={!canDelete} className="modal-danger-btn">
            {deleting ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
