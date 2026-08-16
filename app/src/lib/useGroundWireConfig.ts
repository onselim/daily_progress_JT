import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface GroundWireConfig {
  opgw: number;
  earthwire: number;
}

const EMPTY: GroundWireConfig = { opgw: 0, earthwire: 0 };

export function useGroundWireConfig(projectId: string | undefined) {
  const [config, setConfig] = useState<GroundWireConfig>(EMPTY);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    supabase
      .from('project_config')
      .select('value')
      .eq('project_id', projectId)
      .eq('key', 'ground_wire_config')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const v = (data?.value as Partial<GroundWireConfig> | undefined) ?? {};
        setConfig({ opgw: v.opgw ?? 0, earthwire: v.earthwire ?? 0 });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return config;
}
