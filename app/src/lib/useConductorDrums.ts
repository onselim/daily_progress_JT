import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface ConductorDrum {
  no: number;
  id: string;
  len: number;
  /** 500 = the 500 kV line, 220 = the 220 kV interconnection */
  kv: 500 | 220;
  truck: number;
  date: string;
}

export interface ConductorEtap {
  name: string;
  /** section length incl. 1.5 % allowance (m) */
  sec: number | null;
  /** new drums of this etap (the lengths that arrived); leftovers of other etaps are not listed */
  drums: { len: number; count: number }[];
  use: string;
  noteTr: string;
  noteEn: string;
}

export interface ConductorDrumData {
  conductor: string;
  line: string;
  source: string;
  checked: string;
  drums: ConductorDrum[];
  etaps: ConductorEtap[];
  stock: { len: number; count: number; noteTr: string; noteEn: string }[];
}

/** Conductor drums received on site and the Part-1 etap plan (project_config key 'conductor_drums'). Null until the record exists. */
export function useConductorDrums(projectId: string | undefined) {
  const [data, setData] = useState<ConductorDrumData | null>(null);
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    supabase
      .from('project_config')
      .select('value')
      .eq('project_id', projectId)
      .eq('key', 'conductor_drums')
      .maybeSingle()
      .then(({ data: row }) => {
        if (!cancelled) setData((row?.value as ConductorDrumData | undefined) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  return data;
}
