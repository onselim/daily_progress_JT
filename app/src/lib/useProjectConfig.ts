import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface WorkItemConfig {
  key: string;
  label: string;
  weight: number;
  group?: string;
}

export function useWorkItemsConfig(projectId: string | undefined) {
  const [workItems, setWorkItems] = useState<WorkItemConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from('project_config')
      .select('value')
      .eq('project_id', projectId)
      .eq('key', 'work_items')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setWorkItems(data.value as WorkItemConfig[]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { workItems, loading };
}
