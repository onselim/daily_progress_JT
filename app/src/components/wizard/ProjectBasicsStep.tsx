import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { createProject } from '../../lib/wizard/createProject';
import type { ProjectRow } from '../../lib/useProject';

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
  const [conductorCount, setConductorCount] = useState(3);
  const [opgwCount, setOpgwCount] = useState(1);
  const [earthwireCount, setEarthwireCount] = useState(1);
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
        conductorCount,
        opgwCount,
        earthwireCount,
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

      <div className="wizard-form-row">
        <label>
          Conductors per phase
          <input
            type="number"
            min={1}
            value={conductorCount}
            onChange={(e) => setConductorCount(Number(e.target.value))}
          />
        </label>
        <label>
          OPGW count
          <input type="number" min={0} value={opgwCount} onChange={(e) => setOpgwCount(Number(e.target.value))} />
        </label>
        <label>
          Earthwire count
          <input
            type="number"
            min={0}
            value={earthwireCount}
            onChange={(e) => setEarthwireCount(Number(e.target.value))}
          />
        </label>
      </div>

      {error && <p className="form-message">{error}</p>}

      <button type="submit" disabled={saving || !name.trim()}>
        {saving ? 'Creating…' : 'Next: Work items'}
      </button>
    </form>
  );
}
