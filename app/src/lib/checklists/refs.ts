/** Foundation drawing references for the Jvari-Tskaltubo 500 kV line, read from the approved foundation design sets
 * (Design/Foundation: one drawing sheet per tower type and soil class). The drawings carry no formal drawing number --
 * only the set title, revision and printed page -- so the reference is "<type> Foundation Design, <class>, p.<page>". */

export interface FoundationDrawingRef {
  /** Printed in the "No" column. */
  no: string;
  rev: string;
}

type ClassKey = 'C2' | 'C3' | 'C4.1' | 'C4.2';

interface TypeRefs {
  title: string; // as printed on the drawing sheets
  rev: string;
  pages: Partial<Record<ClassKey, number>>;
}

const STANDARD_PAGES = { C2: 21, C3: 35, 'C4.1': 49, 'C4.2': 63 };

const JVARI: Record<string, TypeRefs> = {
  BNS: { title: 'BNS', rev: 'RB', pages: { C2: 22, C3: 36, 'C4.1': 50, 'C4.2': 64 } },
  B30: { title: 'B-30', rev: 'R1', pages: STANDARD_PAGES },
  B60: { title: 'B-60', rev: 'R1', pages: STANDARD_PAGES },
  B90: { title: 'B-90', rev: 'R1', pages: STANDARD_PAGES },
  BLC: { title: 'BLC', rev: 'R1', pages: STANDARD_PAGES },
  BLS: { title: 'BLS', rev: 'R0', pages: { C2: 21, C3: 35, 'C4.1': 49 } }, // the BLS set has no C4.2 sheet
};

/** The platform stores the soil class as a whole number (3 = Good Soil / C3). Only classes the drawings define are mapped. */
const SOIL_CODE_TO_CLASS: Record<number, ClassKey> = { 2: 'C2', 3: 'C3' };

const ALIASES: Record<string, string> = { B90C: 'B90' }; // B90C has no drawing of its own and uses B90 (project rule)

export function soilClassLabel(soilCode: number | null | undefined): string {
  return soilCode != null && SOIL_CODE_TO_CLASS[soilCode] ? SOIL_CODE_TO_CLASS[soilCode] : soilCode != null ? `C${soilCode}` : '';
}

/** Reference of the foundation drawing sheet for a tower type + soil code, or null when none is defined for the project. */
export function foundationDrawingRef(projectSlug: string, towerType: string | undefined, soilCode: number | null | undefined): FoundationDrawingRef | null {
  if (projectSlug !== 'jvari-tskaltubo' || !towerType || soilCode == null) return null;
  const refs = JVARI[ALIASES[towerType] ?? towerType];
  const cls = SOIL_CODE_TO_CLASS[soilCode];
  const page = cls ? refs?.pages[cls] : undefined;
  if (!refs || !cls || page == null) return null;
  return { no: `${refs.title} Foundation Design, ${cls}, p.${page}`, rev: refs.rev };
}
