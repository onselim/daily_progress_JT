import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { createProject } from '../../lib/wizard/createProject';
import { utmZoneToEpsg } from '../../lib/utmToLatLng';
import { UtmZoneSelect } from './UtmZoneSelect';
import { TowerHeadPreview } from './TowerHeadPreview';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import type { ProjectRow } from '../../lib/useProject';

// Tower-head shapes are engineering configuration names, kept in English across
// languages -- the SVG preview next to the dropdown carries the visual meaning.
const TOWER_HEAD_OPTIONS = [
  { value: 'delta', label: 'Delta' },
  { value: 'cat_head', label: 'Cat-head / Portal' },
  { value: 'vertical_staggered_no_peak', label: 'Vertical (Danube) — staggered, no EW peak' },
  { value: 'vertical_staggered', label: 'Vertical (Danube) — staggered, single EW peak' },
  { value: 'vertical_staggered_double_peak', label: 'Vertical (Danube) — staggered, double EW peak' },
  { value: 'guyed_v', label: 'Guyed V' },
  { value: 'single_ground_peak', label: 'Single ground-wire peak' },
  { value: 'double_ground_peak', label: 'Double ground-wire peak' },
  { value: 'other', label: 'Other…' },
];

interface ProjectBasicsStepProps {
  onComplete: (project: ProjectRow) => void;
}

export function ProjectBasicsStep({ onComplete }: ProjectBasicsStepProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [contractor, setContractor] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [industryType, setIndustryType] = useState('transmission_line');
  const [utmZone, setUtmZone] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [voltage, setVoltage] = useState('');
  const [circuitType, setCircuitType] = useState('single');
  const [towerHeadType, setTowerHeadType] = useState('delta');
  const [towerHeadCustom, setTowerHeadCustom] = useState('');
  const [conductorCount, setConductorCount] = useState(3);
  const [conductorType, setConductorType] = useState('');
  const [opgwCount, setOpgwCount] = useState(1);
  const [opgwType, setOpgwType] = useState('');
  const [earthwireCount, setEarthwireCount] = useState(1);
  const [ewType, setEwType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true);
    setError(null);

    let coordinateSystem = '';
    if (utmZone.trim()) {
      try {
        coordinateSystem = utmZoneToEpsg(utmZone);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setSaving(false);
        return;
      }
    }

    try {
      const project = await createProject({
        name: name.trim(),
        client,
        contractor,
        contractNo,
        industryType,
        utmZone,
        coordinateSystem,
        isPublic,
        voltage,
        circuitType,
        towerHeadType: towerHeadType === 'other' ? towerHeadCustom : towerHeadType,
        conductorCount,
        conductorType,
        opgwCount,
        opgwType,
        earthwireCount,
        ewType,
        createdBy: user.id,
      });
      onComplete(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <form className="wizard-form" onSubmit={handleSubmit}>
      <h2>{t('wizard.basicsTitle')}</h2>

      <label>
        {t('wizard.projectName')}
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <div className="wizard-form-row">
        <label>
          {t('wizard.client')}
          <input value={client} onChange={(e) => setClient(e.target.value)} />
        </label>
        <label>
          {t('wizard.contractor')}
          <input value={contractor} onChange={(e) => setContractor(e.target.value)} />
        </label>
      </div>

      <label>
        {t('wizard.contractNumber')}
        <input value={contractNo} onChange={(e) => setContractNo(e.target.value)} />
      </label>

      <label>
        {t('wizard.industryType')}
        <select value={industryType} onChange={(e) => setIndustryType(e.target.value)}>
          <option value="transmission_line">{t('wizard.industryTransmissionLine')}</option>
          <option value="pipeline">{t('wizard.industryPipeline')}</option>
          <option value="road">{t('wizard.industryRoad')}</option>
          <option value="rail">{t('wizard.industryRail')}</option>
        </select>
      </label>

      <p className="wizard-hint">{t('wizard.utmZoneHint')}</p>
      <UtmZoneSelect value={utmZone} onChange={setUtmZone} />

      <label className="wizard-checkbox-label">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        {t('wizard.publishPublicLink')}
      </label>

      <h3>{t('wizard.lineParameters')}</h3>
      <p className="wizard-hint">{t('wizard.lineParametersHint')}</p>

      <div className="wizard-form-row">
        <label>
          {t('wizard.voltage')}
          <input value={voltage} onChange={(e) => setVoltage(e.target.value)} placeholder="400kV" />
        </label>
        <label>
          {t('wizard.circuitType')}
          <select value={circuitType} onChange={(e) => setCircuitType(e.target.value)}>
            <option value="single">{t('wizard.circuitSingle')}</option>
            <option value="double">{t('wizard.circuitDouble')}</option>
          </select>
        </label>
      </div>

      <div className="wizard-tower-head-row">
        <label>
          {t('wizard.towerHeadConfig')}
          <select value={towerHeadType} onChange={(e) => setTowerHeadType(e.target.value)}>
            {TOWER_HEAD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <TowerHeadPreview type={towerHeadType} circuitType={circuitType} />
      </div>
      {towerHeadType === 'other' && (
        <label>
          {t('wizard.describeTowerHead')}
          <input value={towerHeadCustom} onChange={(e) => setTowerHeadCustom(e.target.value)} />
        </label>
      )}

      <div className="wizard-form-row">
        <label>
          {t('wizard.conductorsPerPhase')}
          <input
            type="number"
            min={1}
            value={conductorCount}
            onChange={(e) => setConductorCount(Number(e.target.value))}
          />
        </label>
        <label>
          {t('wizard.conductorType')}
          <input
            value={conductorType}
            onChange={(e) => setConductorType(e.target.value)}
            placeholder="e.g. ACSR 400/51"
          />
        </label>
      </div>

      <div className="wizard-form-row">
        <label>
          {t('wizard.opgwCount')}
          <input type="number" min={0} value={opgwCount} onChange={(e) => setOpgwCount(Number(e.target.value))} />
        </label>
        <label>
          {t('wizard.opgwType')}
          <input value={opgwType} onChange={(e) => setOpgwType(e.target.value)} placeholder="e.g. OPGW 24F 95mm²" />
        </label>
      </div>

      <div className="wizard-form-row">
        <label>
          {t('wizard.earthwireCount')}
          <input
            type="number"
            min={0}
            value={earthwireCount}
            onChange={(e) => setEarthwireCount(Number(e.target.value))}
          />
        </label>
        <label>
          {t('wizard.earthwireType')}
          <input value={ewType} onChange={(e) => setEwType(e.target.value)} placeholder="e.g. EHS 73mm²" />
        </label>
      </div>

      {error && <p className="form-message">{error}</p>}

      <button type="submit" disabled={saving || !name.trim()}>
        {saving ? t('wizard.creating') : t('wizard.nextWorkItems')}
      </button>
    </form>
  );
}
