import type { Block, ChecklistTemplate, MatrixCol, MatrixRow } from './types';

/** "CheckList for Foundation Works" -- the Bozlar Yapı / DECON / GSE form, sections A-L, rebuilt as data.
 * Three approval stages, each signed by Consultant AND Employer: foundation class (A-C), concreting (D-E),
 * backfilling (F-L). Tolerances are intentionally absent: the paper form has none, so "Difference" is only
 * calculated, never judged. */

/** Legs 1-4 of the form are the project's stub names Z1-Z4, in that order. */
const LEGS: MatrixRow[] = [1, 2, 3, 4].map((n) => ({ key: `leg${n}`, text: String(n), suffix: ` (Z${n})` }));
const LEG_COLS: MatrixCol[] = [1, 2, 3, 4].map((n) => ({ key: `leg${n}`, label: `leg${n}`, suffix: ` (Z${n})` }));
const PAIRS_4: MatrixCol[] = ['1-2', '2-3', '3-4', '4-1'].map((p) => ({ key: p, text: p }));

function legDateObs(id: string): Block {
  return {
    kind: 'matrix',
    id,
    corner: 'leg',
    cols: [
      { key: 'date', label: 'dateShort', type: 'date' },
      { key: 'obs', label: 'observation', type: 'text' },
    ],
    rows: LEGS,
  };
}

export const foundationTemplate: ChecklistTemplate = {
  key: 'foundation',
  version: 1,
  title: 'title_foundation',
  gates: [
    { key: 'class', label: 'gateClass', sectionIds: ['A', 'B', 'C'] },
    { key: 'concreting', label: 'gateConcreting', sectionIds: ['D', 'E'] },
    { key: 'backfill', label: 'gateBackfill', sectionIds: ['F', 'G', 'H', 'I', 'J', 'K', 'L'] },
  ],
  sections: [
    {
      id: 'A',
      title: 'secA',
      blocks: [
        {
          kind: 'fields',
          cols: 4,
          fields: [
            { key: 'towerType', label: 'towerType', prefill: 'towerType' },
            { key: 'bodyExt', label: 'bodyExt', unit: 'm', prefill: 'bodyExt' },
            { key: 'foundClass', label: 'foundClass', prefill: 'foundClass' },
            { key: 'settingLevel', label: 'settingLevel', type: 'number', unit: 'm', prefill: 'settingLevel' },
          ],
        },
        {
          kind: 'matrix',
          id: 'drw',
          corner: 'drawings',
          cols: [
            { key: 'no', label: 'no' },
            { key: 'rev', label: 'rev' },
          ],
          rows: [
            { key: 'foundation', label: 'foundDrawing', prefillFromAsset: 'foundationDrawing' },
            { key: 'stub', label: 'stubDrawing' },
            { key: 'reference', label: 'refDrawing' },
          ],
        },
      ],
    },
    {
      id: 'B',
      title: 'secB',
      blocks: [
        {
          kind: 'matrix',
          id: 'stubmat',
          corner: 'leg',
          cols: [
            { key: 'legExt', label: 'legExt', type: 'text', unit: 'm' },
            { key: 'chimneyExt', label: 'chimneyExt' },
            { key: 'stubMark', label: 'stubMark' },
            { key: 'stubLength', label: 'stubLength', type: 'number', unit: 'mm' },
            { key: 'cleats', label: 'cleats', type: 'number' },
            { key: 'boltType', label: 'type', group: 'cleatBolts' },
            { key: 'boltNo', label: 'no', group: 'cleatBolts' },
          ],
          rows: LEGS.map((r) => ({ ...r, prefillFromAsset: 'legExt' as const })),
        },
      ],
    },
    {
      id: 'C',
      title: 'secC',
      blocks: [
        {
          kind: 'matrix',
          id: 'exc',
          cols: LEG_COLS,
          type: 'text',
          rows: [
            { key: 'depth', label: 'exDepth', unit: 'cm', type: 'number' },
            { key: 'depthBelow', label: 'depthBelow', unit: 'cm', type: 'number' },
            { key: 'width', label: 'exWidth', unit: 'cm' },
            { key: 'dewater', label: 'dewater' },
            { key: 'shutter', label: 'shutter' },
            { key: 'changeClass', label: 'changeClass' },
            { key: 'soilImp', label: 'soilImp' },
            { key: 'deflect', label: 'deflect' },
            { key: 'accept', label: 'acceptCompaction', type: 'yesno' },
          ],
          rowHeaderWide: true,
        },
        { kind: 'text', key: 'comments_C', label: 'commentsLbl' },
        { kind: 'gate', gate: 'class' },
      ],
    },
    {
      id: 'D',
      title: 'secD',
      blocks: [
        {
          kind: 'matrix',
          id: 'distB',
          cols: [...(['1-2', '2-3', '3-4', '4-1'].map((p) => ({ key: p, text: p, group: 'distB' }))), ...(['1-3', '2-4'].map((p) => ({ key: p, text: p, group: 'diagonals' })))],
          type: 'number',
          rows: [
            { key: 'required', label: 'required', unit: 'mm' },
            { key: 'design', label: 'asDesign', unit: 'mm' },
            { key: 'before', label: 'beforeConc', unit: 'mm' },
          ],
          rowHeaderWide: true,
        },
        {
          kind: 'matrix',
          id: 'distA',
          cols: PAIRS_4.map((c) => ({ ...c, group: 'distA' })),
          type: 'number',
          rows: [
            { key: 'required', label: 'required', unit: 'mm' },
            { key: 'design', label: 'asDesign', unit: 'mm' },
            { key: 'before', label: 'beforeConc', unit: 'mm' },
          ],
          rowHeaderWide: true,
        },
        {
          kind: 'matrix',
          id: 'levels',
          corner: 'stubLevels',
          cols: LEG_COLS,
          type: 'number',
          rows: [
            { key: 'measured', label: 'measured', unit: 'mm' },
            { key: 'required', label: 'required', unit: 'mm' },
            { key: 'diff', label: 'difference', unit: 'mm', derive: { a: 'measured', b: 'required' } },
          ],
          rowHeaderWide: true,
        },
      ],
    },
    {
      id: 'E',
      title: 'secE',
      blocks: [
        {
          kind: 'matrix',
          id: 'rebar',
          cols: [1, 2, 3, 4, 5, 6].map((n) => ({ key: `c${n}`, text: String(n) })),
          rows: [
            { key: 'dia', label: 'diameter' },
            { key: 'wt', label: 'weight', unit: 'kg', type: 'number' },
          ],
          rowHeaderWide: true,
        },
        { kind: 'text', key: 'comments_E', label: 'commentsLbl' },
        { kind: 'gate', gate: 'concreting' },
      ],
    },
    {
      id: 'F',
      title: 'secF',
      pageBreakBefore: true,
      blocks: [
        {
          kind: 'fields',
          cols: 3,
          fields: [
            { key: 'refDrawingNo', label: 'refDrawingNo' },
            { key: 'refDrawingRev', label: 'rev' },
            { key: 'concClass', label: 'concClass', unit: 'MPa' },
            { key: 'concTemp', label: 'concTemp', type: 'number', unit: '°C' },
            { key: 'concAdditives', label: 'additives', type: 'yesno' },
            { key: 'readyMix', label: 'readyMix' },
          ],
        },
        {
          kind: 'matrix',
          id: 'mat',
          corner: 'item',
          cols: [
            { key: 'obs', label: 'obsSource', type: 'text' },
            { key: 'comment', label: 'commentsCol', type: 'text' },
          ],
          rows: [
            { key: 'mix', label: 'mixDesign' },
            { key: 'gravel', label: 'gravel' },
            { key: 'sand', label: 'sand' },
            { key: 'additives', label: 'additives' },
            { key: 'wc', label: 'wc' },
          ],
        },
      ],
    },
    {
      id: 'G',
      title: 'secG',
      blocks: [
        {
          kind: 'matrix',
          id: 'slump',
          corner: 'leg',
          cols: [
            { key: 'pad', label: 'pad' },
            { key: 'padSlump', label: 'slump', type: 'number', unit: 'mm' },
            { key: 'chimney', label: 'chimney' },
            { key: 'chimneySlump', label: 'slump', type: 'number', unit: 'mm' },
            { key: 'remarks', label: 'remarks' },
          ],
          rows: LEGS,
        },
      ],
    },
    {
      id: 'H',
      title: 'secH',
      blocks: [
        {
          kind: 'matrix',
          id: 'cubes',
          corner: 'leg',
          cols: [1, 2, 3, 4].flatMap((n): MatrixCol[] => [
            { key: `d${n}`, label: 'dateShort', type: 'date', group: `cubeSet${n}` },
            { key: `i${n}`, label: 'id', group: `cubeSet${n}` },
          ]),
          rows: LEGS,
        },
      ],
    },
    { id: 'I', title: 'secI', blocks: [legDateObs('formwork')] },
    { id: 'J', title: 'secJ', blocks: [legDateObs('curing')] },
    { id: 'K', title: 'secK', blocks: [legDateObs('bitumen'), { kind: 'text', key: 'comments_K', label: 'commentsLbl' }] },
    { id: 'L', title: 'secL', blocks: [legDateObs('compaction'), { kind: 'gate', gate: 'backfill' }, { kind: 'text', key: 'note_L', label: 'noteLbl' }] },
  ],
};

export const TEMPLATES: Record<string, ChecklistTemplate> = { foundation: foundationTemplate };
