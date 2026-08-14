import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { createProject } from '../../lib/wizard/createProject';
import type { ProjectRow } from '../../lib/useProject';

const TOWER_HEAD_OPTIONS = [
  { value: 'delta', label: 'Delta' },
  { value: 'cat_head', label: 'Cat-head / Portal' },
  { value: 'vertical_staggered', label: 'Vertical (Danube) — staggered' },
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
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [contractor, setContractor] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [industryType, setIndustryType] = useState('transmission_line');
  const [utmZone, setUtmZone] = useState('');
  const [coordinateSystem, setCoordinateSystem] = useState('');
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
      <h2>1. Project basics</h2>

      <label>
        Project name *
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <div className="wizard-form-row">
        <label>
          Client
          <input value={client} onChange={(e) => setClient(e.target.value)} />
        </label>
        <label>
          Contractor
          <input value={contractor} onChange={(e) => setContractor(e.target.value)} />
        </label>
      </div>

      <label>
        Contract number
        <input value={contractNo} onChange={(e) => setContractNo(e.target.value)} />
      </label>

      <label>
        Industry type
        <select value={industryType} onChange={(e) => setIndustryType(e.target.value)}>
          <option value="transmission_line">Transmission line</option>
          <option value="pipeline">Pipeline</option>
          <option value="road">Road</option>
          <option value="rail">Rail</option>
        </select>
      </label>

      <div className="wizard-form-row">
        <label>
          UTM zone (e.g. 38N)
          <input value={utmZone} onChange={(e) => setUtmZone(e.target.value)} placeholder="38N" />
        </label>
        <label>
          Coordinate system (EPSG code)
          <input
            value={coordinateSystem}
            onChange={(e) => setCoordinateSystem(e.target.value)}
            placeholder="EPSG:32638"
          />
        </label>
      </div>

      <label className="wizard-checkbox-label">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Publish a public read-only report link for this project
      </label>

      <h3>Line parameters</h3>
      <p className="wizard-hint">
        These are project-wide defaults. Individual towers/spans can still be recorded differently later.
      </p>

      <div className="wizard-form-row">
        <label>
          Voltage
          <input value={voltage} onChange={(e) => setVoltage(e.target.value)} placeholder="400kV" />
        </label>
        <label>
          Circuit type
          <select value={circuitType} onChange={(e) => setCircuitType(e.target.value)}>
            <option value="single">Single</option>
            <option value="double">Double</option>
          </select>
        </label>
      </div>

      <label>
        Tower head configuration
        <select value={towerHeadType} onChange={(e) => setTowerHeadType(e.target.value)}>
          {TOWER_HEAD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {towerHeadType === 'other' && (
        <label>
          Describe the tower head configuration
          <input value={towerHeadCustom} onChange={(e) => setTowerHeadCustom(e.target.value)} />
        </label>
      )}

      <div className="wizard-form-row">
        <label>
          Conductors per phase (bundle)
          <input
            type="number"
            min={1}
            value={conductorCount}
            onChange={(e) => setConductorCount(Number(e.target.value))}
          />
        </label>
        <label>
          Conductor type
          <input
            value={conductorType}
            onChange={(e) => setConductorType(e.target.value)}
            placeholder="e.g. ACSR 400/51"
          />
        </label>
      </div>

      <div className="wizard-form-row">
        <label>
          OPGW count
          <input type="number" min={0} value={opgwCount} onChange={(e) => setOpgwCount(Number(e.target.value))} />
        </label>
        <label>
          OPGW type
          <input value={opgwType} onChange={(e) => setOpgwType(e.target.value)} placeholder="e.g. OPGW 24F 95mm²" />
        </label>
      </div>

      <div className="wizard-form-row">
        <label>
          Earthwire count
          <input
            type="number"
            min={0}
            value={earthwireCount}
            onChange={(e) => setEarthwireCount(Number(e.target.value))}
          />
        </label>
        <label>
          Earthwire type
          <input value={ewType} onChange={(e) => setEwType(e.target.value)} placeholder="e.g. EHS 73mm²" />
        </label>
      </div>

      {error && <p className="form-message">{error}</p>}

      <button type="submit" disabled={saving || !name.trim()}>
        {saving ? 'Creating…' : 'Next: Work items'}
      </button>
    </form>
  );
}
