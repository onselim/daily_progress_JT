import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { ProjectRow } from '../useProject';

export interface PartyBranding {
  name: string;
  /** File names in /checklist-logos (without folder), shown small in the printed header strip. */
  logos: string[];
}

export interface Branding {
  employer: PartyBranding;
  contractor: PartyBranding;
  consultant: PartyBranding;
}

/** Names + logos of the three parties as they appear on the approved Jvari-Tskaltubo paper form and the Structure List cover.
 * Used until a project stores its own `checklist_branding` in project_config (same shape as Branding). */
const DEFAULTS_BY_SLUG: Record<string, Branding> = {
  'jvari-tskaltubo': {
    employer: { name: 'Georgian State Electrosystem, GSE', logos: ['gse.png'] },
    contractor: { name: 'Bozlar Yapı', logos: ['bozlar.png'] },
    consultant: { name: 'DECON Int. Consulting', logos: ['decon.png', 'consulectra.png', 'afry.png'] },
  },
};

function fallback(project: ProjectRow): Branding {
  return (
    DEFAULTS_BY_SLUG[project.slug] ?? {
      employer: { name: project.client ?? '', logos: [] },
      contractor: { name: project.contractor ?? '', logos: [] },
      consultant: { name: '', logos: [] },
    }
  );
}

/** Party names and logos for the checklist header and signature blocks; a project can override them through
 * project_config key `checklist_branding`. */
export function useChecklistBranding(project: ProjectRow | null | undefined): Branding | null {
  const [override, setOverride] = useState<Partial<Branding> | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    supabase
      .from('project_config')
      .select('value')
      .eq('project_id', project.id)
      .eq('key', 'checklist_branding')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setOverride(data?.value && typeof data.value === 'object' ? (data.value as Partial<Branding>) : null);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  if (!project || !ready) return null;
  const base = fallback(project);
  return {
    employer: { ...base.employer, ...override?.employer },
    contractor: { ...base.contractor, ...override?.contractor },
    consultant: { ...base.consultant, ...override?.consultant },
  };
}
