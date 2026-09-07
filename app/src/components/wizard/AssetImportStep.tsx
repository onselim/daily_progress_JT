import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { importAssets, type AssetImportRow } from '../../lib/wizard/importAssets';
import { parseKmlOrKmzFile, type KmlAsset } from '../../lib/wizard/parseKml';
import { utmZoneToEpsg } from '../../lib/utmToLatLng';
import { UtmZoneSelect } from './UtmZoneSelect';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import type { TranslationKey } from '../../lib/i18n/translations/en';
import type { ProjectRow } from '../../lib/useProject';

type FieldKey = 'asset_code' | 'asset_type' | 'x' | 'y' | 'z' | 'station';

// `guesses` search real spreadsheet header text, which stays English regardless of UI
// language -- only `labelKey` (what's shown on screen) is translated.
const FIELDS: { key: FieldKey; labelKey: TranslationKey; required: boolean; guesses: string[] }[] = [
  {
    key: 'asset_code',
    labelKey: 'wizard.fieldAssetCode',
    required: true,
    guesses: ['construction no', 'construction', 'tower no', 'tower code', 'structure no', 'code'],
  },
  { key: 'asset_type', labelKey: 'wizard.fieldAssetType', required: false, guesses: ['tower type', 'type'] },
  { key: 'x', labelKey: 'wizard.fieldX', required: true, guesses: ['x coord', 'x-coord', ' x', 'x(', 'easting'] },
  { key: 'y', labelKey: 'wizard.fieldY', required: true, guesses: ['y coord', 'y-coord', ' y', 'y(', 'northing'] },
  { key: 'z', labelKey: 'wizard.fieldZ', required: false, guesses: ['z coord', 'z-coord', ' z', 'elev'] },
  { key: 'station', labelKey: 'wizard.fieldStation', required: false, guesses: ['station', 'chainage', 'sta'] },
];

const TYPE_CATEGORY_OPTIONS: { value: string; labelKey: TranslationKey }[] = [
  { value: 'suspension', labelKey: 'wizard.typeCategorySuspension' },
  { value: 'tension', labelKey: 'wizard.typeCategoryTension' },
  { value: 'terminal', labelKey: 'wizard.typeCategoryTerminal' },
  { value: 'gantry', labelKey: 'wizard.typeCategoryGantry' },
  { value: 'other', labelKey: 'wizard.typeCategoryOther' },
];

const MAX_HEADER_SCAN_ROWS = 25;

function cellText(cell: unknown): string {
  return (cell ?? '').toString().trim();
}

function guessColumn(headers: string[], guesses: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const guess of guesses) {
    const idx = lower.findIndex((h) => h.includes(guess));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** How many of our known field keywords appear anywhere in this row's cells — a proxy for "this looks like the real header row." */
function scoreHeaderRow(row: unknown[]): number {
  const cells = row.map((c) => cellText(c).toLowerCase());
  let score = 0;
  for (const field of FIELDS) {
    if (field.guesses.some((g) => cells.some((c) => c.includes(g)))) score += 1;
  }
  return score;
}

function detectHeaderRowIndex(allRows: unknown[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(allRows.length, MAX_HEADER_SCAN_ROWS);
  for (let i = 0; i < limit; i++) {
    const score = scoreHeaderRow(allRows[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function rowPreview(row: unknown[]): string {
  const cells = row.map(cellText).filter(Boolean);
  return cells.length > 0 ? cells.slice(0, 6).join(' | ') : '(empty row)';
}

function sampleNumericColumn(rows: unknown[][], idx: number, limit = 20): number[] {
  if (idx === -1) return [];
  const vals: number[] = [];
  for (const row of rows) {
    if (vals.length >= limit) break;
    const v = Number(row[idx]);
    if (Number.isFinite(v) && v !== 0) vals.push(Math.abs(v));
  }
  return vals;
}

/** Integer-part digit count of the median sample value (e.g. 428562.18 -> 6). */
function medianDigits(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median <= 0) return null;
  return Math.floor(Math.log10(median)) + 1;
}

/**
 * UTM eastings are conventionally 6 digits, northings 7 — if the header-based
 * guess put them backwards, swap based on the actual data.
 */
function verifyUtmAxes(
  xIdx: number,
  yIdx: number,
  body: unknown[][],
): { x: number; y: number; corrected: boolean } {
  if (xIdx === -1 || yIdx === -1) return { x: xIdx, y: yIdx, corrected: false };
  const xDigits = medianDigits(sampleNumericColumn(body, xIdx));
  const yDigits = medianDigits(sampleNumericColumn(body, yIdx));
  if (xDigits === 7 && yDigits === 6) {
    return { x: yIdx, y: xIdx, corrected: true };
  }
  return { x: xIdx, y: yIdx, corrected: false };
}

interface AssetImportStepProps {
  project: ProjectRow;
  onComplete: () => void;
  onBack: () => void;
}

export function AssetImportStep({ project, onComplete, onBack }: AssetImportStepProps) {
  const { t } = useLanguage();
  const projectId = project.id;
  const [mode, setMode] = useState<'spreadsheet' | 'kml'>('spreadsheet');
  const [utmZone, setUtmZone] = useState(project.utm_zone ?? '');
  const [kmlAssets, setKmlAssets] = useState<KmlAsset[]>([]);
  const [kmlFileName, setKmlFileName] = useState('');
  const [kmlError, setKmlError] = useState<string | null>(null);
  const [kmlImporting, setKmlImporting] = useState(false);

  const [allRows, setAllRows] = useState<unknown[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(-1);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>({
    asset_code: -1,
    asset_type: -1,
    x: -1,
    y: -1,
    z: -1,
    station: -1,
  });
  const [autoCorrectedXY, setAutoCorrectedXY] = useState(false);
  const [typeCategories, setTypeCategories] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const headers = useMemo(
    () => (headerRowIndex >= 0 && allRows[headerRowIndex] ? allRows[headerRowIndex].map(cellText) : []),
    [allRows, headerRowIndex],
  );

  const dataRows = useMemo(() => {
    if (headerRowIndex < 0) return [];
    return allRows.slice(headerRowIndex + 1).filter((r) => r.some((cell) => cellText(cell) !== ''));
  }, [allRows, headerRowIndex]);

  // Re-guess the column mapping whenever the header row (or which file/sheet) changes.
  useEffect(() => {
    if (headers.length === 0) return;

    const guessedX = guessColumn(headers, FIELDS[2].guesses);
    const guessedY = guessColumn(headers, FIELDS[3].guesses);
    const { x, y, corrected } = verifyUtmAxes(guessedX, guessedY, dataRows);

    setAutoCorrectedXY(corrected);
    setMapping({
      asset_code: guessColumn(headers, FIELDS[0].guesses),
      asset_type: guessColumn(headers, FIELDS[1].guesses),
      x,
      y,
      z: guessColumn(headers, FIELDS[4].guesses),
      station: guessColumn(headers, FIELDS[5].guesses),
    });
    // Only re-run when the header row itself changes, not on every dataRows re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setFileName(file.name);
    setTypeCategories({});

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

      if (rows.length < 2) {
        setParseError(t('wizard.noDataRows'));
        return;
      }

      setAllRows(rows);
      setHeaderRowIndex(detectHeaderRowIndex(rows));
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

  const resolvedRows = useMemo(() => dataRows.map(resolveRow), [dataRows, mapping]);
  const previewRows = resolvedRows.slice(0, 10);

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    for (const r of resolvedRows) {
      if (r?.asset_type) set.add(r.asset_type);
    }
    return Array.from(set).sort();
  }, [resolvedRows]);

  const canImport =
    mapping.asset_code !== -1 &&
    mapping.x !== -1 &&
    mapping.y !== -1 &&
    dataRows.length > 0 &&
    utmZone.trim() !== '' &&
    !importing;

  async function handleImport() {
    setImporting(true);
    setImportError(null);

    const rows = resolvedRows.filter((r): r is AssetImportRow => r !== null);

    try {
      if (utmZone.trim() && utmZone !== project.utm_zone) {
        const coordinateSystem = utmZoneToEpsg(utmZone);
        const { error } = await supabase
          .from('projects')
          .update({ utm_zone: utmZone, coordinate_system: coordinateSystem })
          .eq('id', projectId);
        if (error) throw error;
      }

      await importAssets(projectId, rows);

      if (uniqueTypes.length > 0) {
        const categories = Object.fromEntries(uniqueTypes.map((t) => [t, typeCategories[t] ?? 'other']));
        await supabase
          .from('project_config')
          .upsert(
            { project_id: projectId, key: 'asset_type_categories', value: categories },
            { onConflict: 'project_id,key' },
          );
      }

      onComplete();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  const headerCandidates = allRows.slice(0, Math.min(allRows.length, MAX_HEADER_SCAN_ROWS));

  async function handleKmlFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setKmlError(null);
    setKmlFileName(file.name);

    try {
      const assets = await parseKmlOrKmzFile(file);
      if (assets.length === 0) {
        setKmlError(t('wizard.noPlacemarks'));
        return;
      }
      setKmlAssets(assets);
    } catch (err) {
      setKmlError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleKmlImport() {
    setKmlImporting(true);
    setKmlError(null);

    const rows: AssetImportRow[] = kmlAssets.map((a) => ({
      asset_code: a.code,
      lat: a.lat,
      lng: a.lng,
      z: a.elevation,
      asset_type: a.assetType,
      station: a.station,
    }));

    try {
      await importAssets(projectId, rows);
      onComplete();
    } catch (err) {
      setKmlError(err instanceof Error ? err.message : String(err));
    } finally {
      setKmlImporting(false);
    }
  }

  return (
    <div className="wizard-form">
      <h2>{t('wizard.importTitle')}</h2>

      <div className="wizard-mode-toggle">
        <button
          type="button"
          className={mode === 'spreadsheet' ? 'active' : ''}
          onClick={() => setMode('spreadsheet')}
        >
          {t('wizard.excelCsv')}
        </button>
        <button type="button" className={mode === 'kml' ? 'active' : ''} onClick={() => setMode('kml')}>
          {t('wizard.kmlKmz')}
        </button>
      </div>

      {mode === 'spreadsheet' ? (
        <>
          <p className="wizard-hint">{t('wizard.uploadStructureListHint')}</p>

          <p className="wizard-hint">{t('wizard.utmZoneRequiredHint')}</p>
          <UtmZoneSelect value={utmZone} onChange={setUtmZone} />

          <label className="photo-upload-label">
            {fileName || t('wizard.chooseFile')}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          </label>

          {parseError && <p className="form-message">{parseError}</p>}
        </>
      ) : (
        <>
          <p className="wizard-hint">{t('wizard.kmlHint')}</p>

          <label className="photo-upload-label">
            {kmlFileName || t('wizard.chooseFile')}
            <input type="file" accept=".kml,.kmz" onChange={handleKmlFile} />
          </label>

          {kmlError && <p className="form-message">{kmlError}</p>}

          {kmlAssets.length > 0 && (
            <fieldset className="wizard-fieldset">
              <legend>{t('wizard.previewPlacemarksCount', { count: kmlAssets.length })}</legend>
              <div className="wizard-preview-scroll">
                <table className="pd-table">
                  <thead>
                    <tr>
                      <th>{t('wizard.code')}</th>
                      <th>{t('common.type')}</th>
                      <th>{t('common.station')}</th>
                      <th>{t('wizard.lat')}</th>
                      <th>{t('wizard.lng')}</th>
                      <th>{t('wizard.elevation')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kmlAssets.slice(0, 10).map((a, i) => (
                      <tr key={i}>
                        <td>{a.code}</td>
                        <td>{a.assetType ?? '—'}</td>
                        <td>{a.station ?? '—'}</td>
                        <td>{a.lat}</td>
                        <td>{a.lng}</td>
                        <td>{a.elevation ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </fieldset>
          )}

          <div className="wizard-actions">
            <button type="button" onClick={onBack} className="wizard-secondary-btn">
              {t('common.back')}
            </button>
            <button type="button" onClick={handleKmlImport} disabled={kmlAssets.length === 0 || kmlImporting}>
              {kmlImporting ? t('wizard.importing') : t('wizard.importAndFinish', { count: kmlAssets.length || '' })}
            </button>
          </div>
        </>
      )}

      {mode === 'spreadsheet' && allRows.length > 0 && (
        <>
          <label>
            {t('wizard.headerRowLabel')}
            <select value={headerRowIndex} onChange={(e) => setHeaderRowIndex(Number(e.target.value))}>
              {headerCandidates.map((row, i) => (
                <option key={i} value={i}>
                  {t('wizard.rowPreview', { n: i + 1, preview: rowPreview(row) })}
                </option>
              ))}
            </select>
          </label>

          {autoCorrectedXY && <p className="wizard-hint">{t('wizard.autoCorrectedHint')}</p>}

          <fieldset className="wizard-fieldset">
            <legend>{t('wizard.mapColumns')}</legend>
            {FIELDS.map((field) => (
              <div key={field.key} className="wizard-work-item-row">
                <span>
                  {t(field.labelKey)}
                  {field.required && ' *'}
                </span>
                <select
                  value={mapping[field.key]}
                  onChange={(e) =>
                    setMapping((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                  }
                >
                  <option value={-1}>{t('wizard.none')}</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || t('wizard.column', { n: i + 1 })}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </fieldset>

          <fieldset className="wizard-fieldset">
            <legend>{t('wizard.previewRowsCount', { count: dataRows.length })}</legend>
            <div className="wizard-preview-scroll">
              <table className="pd-table">
                <thead>
                  <tr>
                    <th>{t('wizard.code')}</th>
                    <th>{t('common.type')}</th>
                    <th>X</th>
                    <th>Y</th>
                    <th>Z</th>
                    <th>{t('common.station')}</th>
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

          {uniqueTypes.length > 0 && (
            <fieldset className="wizard-fieldset">
              <legend>{t('wizard.classifyTowerTypes', { count: uniqueTypes.length })}</legend>
              <p className="wizard-hint">{t('wizard.classifyHint')}</p>
              {uniqueTypes.map((assetType) => (
                <div key={assetType} className="wizard-work-item-row">
                  <span>{assetType}</span>
                  <select
                    value={typeCategories[assetType] ?? 'other'}
                    onChange={(e) => setTypeCategories((prev) => ({ ...prev, [assetType]: e.target.value }))}
                  >
                    {TYPE_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </fieldset>
          )}
        </>
      )}

      {mode === 'spreadsheet' && (
        <>
          {importError && <p className="form-message">{importError}</p>}

          <div className="wizard-actions">
            <button type="button" onClick={onBack} className="wizard-secondary-btn">
              {t('common.back')}
            </button>
            <button type="button" onClick={handleImport} disabled={!canImport}>
              {importing ? t('wizard.importing') : t('wizard.importAndFinish', { count: dataRows.length || '' })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
