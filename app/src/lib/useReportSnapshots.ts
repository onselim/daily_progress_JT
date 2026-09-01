import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface ReportSnapshot {
  report_date: string;
  pdf_url: string;
}

export function useReportSnapshots(projectId: string | undefined) {
  const [snapshots, setSnapshots] = useState<ReportSnapshot[]>([]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    supabase
      .from('daily_report_snapshots')
      .select('report_date, pdf_url')
      .eq('project_id', projectId)
      .order('report_date', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setSnapshots(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { snapshots };
}
