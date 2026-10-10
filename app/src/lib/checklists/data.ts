import type { AssetListItem } from '../useAssets';
import { parseTowerType } from '../useTowerWeightsConfig';
import { foundationDrawingRef, soilClassLabel } from './refs';
import type { Block, ChecklistData, ChecklistTemplate, MatrixCol, MatrixRow } from './types';

export const cellKey = (blockId: string, rowKey: string, colKey: string) => `${blockId}.${rowKey}.${colKey}`;

/** Every matrix / field block of a template, in order (sections flattened). */
export function allBlocks(template: ChecklistTemplate): { sectionId: string; block: Block }[] {
  return template.sections.flatMap((s) => s.blocks.map((block) => ({ sectionId: s.id, block })));
}

/** Value of a derived row (a - b of the same column), or '' when either side is empty / not a number. */
export function derivedValue(data: ChecklistData, blockId: string, row: MatrixRow, col: MatrixCol): string {
  if (!row.derive) return '';
  const a = parseFloat((data[cellKey(blockId, row.derive.a, col.key)] ?? '').replace(',', '.'));
  const b = parseFloat((data[cellKey(blockId, row.derive.b, col.key)] ?? '').replace(',', '.'));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  const d = Math.round((a - b) * 100) / 100;
  return d > 0 ? `+${d}` : String(d);
}

function legExtText(asset: AssetListItem, leg: number): string {
  const v = [asset.leg1_ext_m, asset.leg2_ext_m, asset.leg3_ext_m, asset.leg4_ext_m][leg - 1];
  if (v == null) return '';
  return `${v > 0 ? '+' : ''}${v}`;
}

/** Values the platform already knows about the tower, used to pre-fill EMPTY fields (never overwrites typed data). */
export function prefillFromAsset(template: ChecklistTemplate, asset: AssetListItem, existing: ChecklistData, projectSlug = ''): ChecklistData {
  const out: ChecklistData = {};
  for (const { block } of allBlocks(template)) {
    if (block.kind === 'fields') {
      for (const f of block.fields) {
        if (existing[f.key]) continue;
        const parsed = parseTowerType(asset.asset_type);
        if (f.prefill === 'towerType' && asset.asset_type) out[f.key] = parsed?.type ?? asset.asset_type;
        if (f.prefill === 'bodyExt' && parsed) out[f.key] = parsed.bodyExtM > 0 ? `+${parsed.bodyExtM}` : String(parsed.bodyExtM);
        // Design soil / foundation class recorded on the tower (project_config foundation_types: "Class 3 / C-3" = Good Soil).
        if (f.prefill === 'foundClass' && asset.soil_type != null) out[f.key] = soilClassLabel(asset.soil_type);
        if (f.prefill === 'settingLevel' && asset.z != null) out[f.key] = String(Math.round(asset.z * 100) / 100);
      }
    } else if (block.kind === 'matrix') {
      for (const row of block.rows) {
        if (row.prefillFromAsset === 'foundationDrawing') {
          const ref = foundationDrawingRef(projectSlug, parseTowerType(asset.asset_type)?.type, asset.soil_type);
          if (ref) {
            if (!existing[cellKey(block.id, row.key, 'no')]) out[cellKey(block.id, row.key, 'no')] = ref.no;
            if (!existing[cellKey(block.id, row.key, 'rev')]) out[cellKey(block.id, row.key, 'rev')] = ref.rev;
          }
          continue;
        }
        if (row.prefillFromAsset !== 'legExt') continue;
        const leg = parseInt(row.key.replace('leg', ''), 10);
        const key = cellKey(block.id, row.key, 'legExt');
        if (!existing[key]) {
          const v = legExtText(asset, leg);
          if (v) out[key] = v;
        }
      }
    }
  }
  return out;
}

export function cellTypeOf(block: Extract<Block, { kind: 'matrix' }>, row: MatrixRow, col: MatrixCol) {
  return row.type ?? col.type ?? block.type ?? 'text';
}
