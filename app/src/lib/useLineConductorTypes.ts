import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface LineConductorTypes {
  conductor: string;
  opgw: string;
  earthwire: string;
}

/** These three values already exist as separate project_config rows, set once during
 * the New Project wizard (see createProject.ts) -- reused here rather than inventing a
 * new bundled config key. Defaults match this pilot line's actual spec when a project
 * was created before this field existed (or was left blank). */
const DEFAULTS: LineConductorTypes = { conductor: 'AC400/51', opgw: 'OPGW95', earthwire: 'AC95' };

const KEY_BY_CHANNEL: Record<keyof LineConductorTypes, string> = {
  conductor: 'conductor_type',
  opgw: 'opgw_type',
  earthwire: 'earthwire_type',
};

export function useLineConductorTypes(projectId: string | undefined) {
  const [types, setTypes] = useState<LineConductorTypes>(DEFAULTS);

  const refresh = useCallback(() => {
    if (!projectId) return;
    supabase
      .from('project_config')
      .select('key, value')
      .eq('project_id', projectId)
      .in('key', Object.values(KEY_BY_CHANNEL))
      .then(({ data }) => {
        if (!data) return;
        const next = { ...DEFAULTS };
        for (const row of data) {
          const channel = (Object.keys(KEY_BY_CHANNEL) as (keyof LineConductorTypes)[]).find(
            (c) => KEY_BY_CHANNEL[c] === row.key,
          );
          if (channel && typeof row.value === 'string' && row.value.trim()) {
            next[channel] = row.value;
          }
        }
        setTypes(next);
      });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save(channel: keyof LineConductorTypes, value: string) {
    if (!projectId) return { error: 'No project' };
    const { error } = await supabase
      .from('project_config')
      .upsert({ project_id: projectId, key: KEY_BY_CHANNEL[channel], value }, { onConflict: 'project_id,key' });
    if (!error) setTypes((prev) => ({ ...prev, [channel]: value }));
    return { error: error?.message ?? null };
  }

  return { types, save };
}
