import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface StubTableEntry {
  bodyExtM: number;
  legExtM: number;
  wMm: number;
  bMm: number;
}

export interface StubSettingConfig {
  type: string;
  angleFactor: { a: number; j: number; k: number };
  table: StubTableEntry[];
}

export function useStubSettingsConfig(projectId: string | undefined) {
  const [stubSettings, setStubSettings] = useState<StubSettingConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('project_config')
      .select('value')
      .eq('project_id', projectId)
      .eq('key', 'stub_settings')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setStubSettings(data.value as StubSettingConfig[]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { stubSettings, loading };
}
