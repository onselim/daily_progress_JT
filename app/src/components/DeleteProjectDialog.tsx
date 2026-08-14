import { useState } from 'react';
import { deleteProject } from '../lib/wizard/deleteProject';

interface DeleteProjectDialogProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteProjectDialog({ projectId, projectName, onClose, onDeleted }: DeleteProjectDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText === projectName && !deleting;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteProject(projectId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Delete project?</h2>
        <p className="access-banner-sub">
          This permanently deletes <strong>{projectName}</strong> and everything in it — every asset, photo,
          document, daily log, and the public report link. This cannot be undone.
        </p>
        <label>
          Type <strong>{projectName}</strong> to confirm
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
