import { useState } from 'react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { TranslationKey } from '../lib/i18n/translations/en';
import type { LineConductorTypes } from '../lib/useLineConductorTypes';

const LABEL_KEY: Record<keyof LineConductorTypes, TranslationKey> = {
  conductor: 'wizard.conductorType',
  opgw: 'wizard.opgwType',
  earthwire: 'wizard.earthwireType',
};

interface ConductorTypeDialogProps {
  channel: keyof LineConductorTypes;
  currentValue: string;
  onSave: (channel: keyof LineConductorTypes, value: string) => Promise<{ error: string | null }>;
  onClose: () => void;
}

export function ConductorTypeDialog({ channel, currentValue, onSave, onClose }: ConductorTypeDialogProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    const { error } = await onSave(channel, trimmed);
    setSaving(false);
    if (error) {
      setError(t('common.saveFailed', { message: error }));
      return;
    }
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t(LABEL_KEY[channel])}</h2>
        <label>
          {t(LABEL_KEY[channel])}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
            autoFocus
            className="modal-confirm-input"
          />
        </label>

        {error && <p className="form-message">{error}</p>}

        <div className="wizard-actions">
          <button type="button" onClick={onClose} className="wizard-secondary-btn">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !value.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
