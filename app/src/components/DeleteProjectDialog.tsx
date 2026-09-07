import { useState } from 'react';
import { deleteProject } from '../lib/wizard/deleteProject';
import { useLanguage } from '../lib/i18n/LanguageContext';

interface DeleteProjectDialogProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteProjectDialog({ projectId, projectName, onClose, onDeleted }: DeleteProjectDialogProps) {
  const { t } = useLanguage();
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
        <h2 className="modal-title">{t('deleteProject.title')}</h2>
        <p className="access-banner-sub">{t('deleteProject.body', { name: projectName })}</p>
        <label>
          {t('deleteProject.typeToConfirm', { name: projectName })}
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
            {deleting ? t('common.deleting') : t('deleteProject.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
