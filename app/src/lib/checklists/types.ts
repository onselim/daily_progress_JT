/** Checklist template model. A template is plain data (sections made of blocks), so adding a new checklist
 * (erection, stringing, OPGW, ...) means writing another template file -- no new UI code or migration.
 * Every label is an id into labels.ts (9 languages); the printed sheet shows English + a chosen language. */

export type CellType = 'text' | 'number' | 'date' | 'yn' | 'ynna' | 'yesno';

/** One typed-in value per cell, keyed `${blockId}.${rowKey}.${colKey}` (matrix) or `${fieldKey}` (fields). */
export type ChecklistData = Record<string, string>;

export interface FieldDef {
  key: string;
  label: string; // label id
  type?: CellType;
  unit?: string; // printed after the label, e.g. "mm"
  /** Filled from the tower (asset) record the first time the checklist is opened. */
  prefill?: 'towerType' | 'bodyExt' | 'settingLevel' | 'foundClass';
}

export interface MatrixCol {
  key: string;
  label?: string; // label id
  text?: string; // literal header (e.g. "1-2")
  type?: CellType;
  unit?: string;
  group?: string; // label id of a spanning group header above this column
  suffix?: string; // printed right after the header, e.g. " (Z1)"
}

export interface MatrixRow {
  key: string;
  label?: string; // label id
  text?: string; // literal row header (e.g. "1")
  type?: CellType;
  unit?: string;
  /** Read-only row = value(a) - value(b) of the same column (e.g. Difference = Measured - Required). */
  derive?: { a: string; b: string };
  suffix?: string; // printed right after the header, e.g. " (Z1)"
  /** Per-column tower-record prefill (Leg Extension from the platform's leg extension values). */
  prefillFromAsset?: 'legExt' | 'foundationDrawing';
}

export type Block =
  | { kind: 'fields'; cols: number; fields: FieldDef[] }
  | { kind: 'matrix'; id: string; corner?: string; cols: MatrixCol[]; rows: MatrixRow[]; type?: CellType; rowHeaderWide?: boolean }
  | { kind: 'text'; key: string; label: string }
  | { kind: 'gate'; gate: string };

export interface Section {
  id: string;
  title: string; // label id
  blocks: Block[];
  /** Start a new printed page before this section. */
  pageBreakBefore?: boolean;
}

export interface GateDef {
  key: string;
  label: string; // label id, e.g. "Accepted for Concreting"
  /** Sections that become read-only once this stage is submitted. */
  sectionIds: string[];
}

export interface ChecklistTemplate {
  key: string; // 'foundation'
  version: number;
  title: string; // label id
  gates: GateDef[];
  sections: Section[];
}

export const PARTIES = ['consultant', 'employer'] as const;
export type Party = (typeof PARTIES)[number];

export type GateStatus = 'draft' | 'submitted' | 'approved';

export interface PartyApproval {
  status: 'pending' | 'approved' | 'rejected';
  name?: string;
  at?: string;
  comment?: string;
}

export interface GateState {
  status: GateStatus;
  submitted_at?: string;
  submitted_by?: string;
  approvals?: Partial<Record<Party, PartyApproval>>;
}

export type GatesState = Record<string, GateState>;

/** A stage is approved only when BOTH Consultant and Employer have approved it. */
export function effectiveGateStatus(g: GateState | undefined): GateStatus {
  if (!g || g.status === 'draft') return 'draft';
  const a = g.approvals;
  if (a && PARTIES.every((p) => a[p]?.status === 'approved')) return 'approved';
  return 'submitted';
}

/** Whole-checklist status: Approved once every stage is approved; "in approval" while anything is submitted. */
export function overallStatus(template: ChecklistTemplate, gates: GatesState): 'draft' | 'inReview' | 'approved' {
  const st = template.gates.map((g) => effectiveGateStatus(gates[g.key]));
  if (st.every((s) => s === 'approved')) return 'approved';
  if (st.some((s) => s !== 'draft')) return 'inReview';
  return 'draft';
}
