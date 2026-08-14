import { useMemo, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { importAssets, type AssetImportRow } from '../../lib/wizard/importAssets';

type FieldKey = 'asset_code' | 'asset_type' | 'x' | 'y' | 'z' | 'station';

const FIELDS: { key: FieldKey; label: string; required: boolean; guesses: string[] }[] = [
  { key: 'asset_code', label: 'Asset code', required: true, guesses: ['code', 'no', 'tower', 'construction'] },
  { key: 'asset_type', label: 'Asset type', required: false, guesses: ['type'] },
  { key: 'x', label: 'X coordinate', required: true, guesses: ['x coord', ' x', 'x('] },
  { key: 'y', label: 'Y coordinate', required: true, guesses: ['y coord', ' y', 'y('] },
  { key: 'z', label: 'Z coordinate / elevation', required: false, guesses: ['z coord', ' z', 'elev'] },
  { key: 'station', label: 'Station / chainage', required: false, guesses: ['station', 'chainage', 'sta'] },
];

function guessColumn(headers: string[], guesses: string[]): number {
  const lower = headers.map((h) => (h ?? '').toString().toLowerCase());
  for (const guess of guesses) {
    const idx = lower.findIndex((h) => h.includes(guess));
    if (idx !== -1) return idx;
  }
  return -1;
}

interface AssetImportStepProps {
  projectId: string;
  onComplete: () => void;
  onBack: () => void;
}

export function AssetImportStep({ projectId, onComplete, onBack }: AssetImportStepProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({
    asset_code: -1,
    asset_type: -1,
    x: -1,
    y: -1,
    z: -1,
    station: -1,
  });
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

      if (rows.length < 2) {
        setParseError('No data rows found in the first sheet.');
        return;
      }

      const headerRow = rows[0].map((h) => String(h ?? ''));
      const body = rows.slice(1).filter((r) => r.some((cell) => cell !== '' && cell != null));

      setHeaders(headerRow);
      setDataRows(body);
      setMapping({
        asset_code: guessColumn(headerRow, FIELDS[0].guesses),
        asset_type: guessColumn(headerRow, FIELDS[1].guesses),
        x: guessColumn(headerRow, FIELDS[2].guesses),
        y: guessColumn(headerRow, FIELDS[3].guesses),
        z: guessColumn(headerRow, FIELDS[4].guesses),
        station: guessColumn(headerRow, FIELDS[5].guesses),
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    }
  }

  function resolveRow(row: unknown[]): AssetImportRow | null {
    const codeIdx = mapping.asset_code;
    if (codeIdx === -1) return null;
    const code = row[codeIdx];
    if (code === undefined || code === null || String(code).trim() === '') return null;

    const num = (idx: number): number | null => {
      if (idx === -1) return null;
      const v = Number(row[idx]);
      return Number.isFinite(v) ? v : null;
    };

    return {
      asset_code: String(code).trim(),
      asset_type: mapping.asset_type !== -1 ? String(row[mapping.asset_type] ?? '').trim() || null : null,
      x: num(mapping.x),
      y: num(mapping.y),
      z: num(mapping.z),
      station: mapping.station !== -1 ? String(row[mapping.station] ?? '').trim() || null : null,
    };
  }

  const previewRows = useMemo(() => dataRows.slice(0, 10).map(resolveRow), [dataRows, mapping]);

  const canImport =
    mapping.asset_code !== -1 && mapping.x !== -1 && mapping.y !== -1 && dataRows.length > 0 && !importing;

  async function handleImport() {
    setImporting(true);
    setImportError(null);

    const rows = dataRows.map(resolveRow).filter((r): r is AssetImportRow => r !== null);

    try {
      await importAssets(projectId, rows);
      onComplete();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="wizard-form">
      <h2>3. Import structure list</h2>
      <p className="wizard-hint">
        Upload the project's structure list as .xlsx or .csv. Excel/CSV is the reliable format — PDF exports vary
        too much between projects to parse automatically.
      </p>

      <label className="photo-upload-label">
        {fileName || '+ Choose file'}
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
      </label>

      {parseError && <p className="form-message">{parseError}</p>}

      {headers.length > 0 && (
        <>
          <fieldset className="wizard-fieldset">
            <legend>Map columns</legend>
            {FIELDS.map((field) => (
              <div key={field.key} className="wizard-work-item-row">
                <span>
                  {field.label}
                  {field.required && ' *'}
                </span>
                <select
                  value={mapping[field.key]}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                  }
                >
                  <option value={-1}>— none —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </fieldset>

          <fieldset className="wizard-fieldset">
            <legend>
              Preview ({dataRows.length} row{dataRows.length === 1 ? '' : 's'} detected)
            </legend>
            <div className="wizard-preview-scroll">
              <table className="pd-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Type</th>
                    <th>X</th>
                    <th>Y</th>
                    <th>Z</th>
                    <th>Station</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r?.asset_code ?? '—'}</td>
                      <td>{r?.asset_type ?? '—'}</td>
                      <td>{r?.x ?? '—'}</td>
                      <td>{r?.y ?? '—'}</td>
                      <td>{r?.z ?? '—'}</td>
                      <td>{r?.station ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>
        </>
      )}

      {importError && <p className="form-message">{importError}</p>}

      <div className="wizard-actions">
        <button type="button" onClick={onBack} className="wizard-secondary-btn">
          Back
        </button>
        <button type="button" onClick={handleImport} disabled={!canImport}>
          {importing ? 'Importing…' : `Import ${dataRows.length || ''} assets & finish`}
        </button>
      </div>
    </div>
  );
}
