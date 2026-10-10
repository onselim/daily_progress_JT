import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { ChecklistData, GatesState } from './types';

export interface ChecklistInstance {
  id: string;
  project_id: string;
  asset_id: string;
  template_key: string;
  template_version: number;
  doc_no: string | null;
  rev: string | null;
  data: ChecklistData;
  gates: GatesState;
  updated_at: string;
}

const COLUMNS = 'id, project_id, asset_id, template_key, template_version, doc_no, rev, data, gates, updated_at';

/** Loads the checklist of one tower for one template (null until the first save) and saves it back. */
export function useChecklist(projectId: string | undefined, assetId: string | undefined, templateKey: string, templateVersion: number) {
  const [instance, setInstance] = useState<ChecklistInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !assetId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .from('checklist_instances')
      .select(COLUMNS)
      .eq('asset_id', assetId)
      .eq('template_key', templateKey)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setInstance((data as ChecklistInstance | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, assetId, templateKey]);

  /** Creates the row on first save, updates it afterwards. */
  const save = useCallback(
    async (payload: { data: ChecklistData; gates: GatesState; doc_no: string; rev: string }, event: { action: string; detail?: Record<string, unknown> }) => {
      if (!projectId || !assetId) return { error: 'No tower' };
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const row = {
        project_id: projectId,
        asset_id: assetId,
        template_key: templateKey,
        template_version: templateVersion,
        doc_no: payload.doc_no || null,
        rev: payload.rev || null,
        data: payload.data,
        gates: payload.gates,
        ...(instance ? {} : { created_by: userId }),
      };
      const { data, error: err } = await supabase
        .from('checklist_instances')
        .upsert(row, { onConflict: 'asset_id,template_key' })
        .select(COLUMNS)
        .single();
      if (err || !data) return { error: err?.message ?? 'Save failed' };
      setInstance(data as ChecklistInstance);
      await supabase.from('checklist_events').insert({ instance_id: data.id, user_id: userId, action: event.action, detail: event.detail ?? {} });
      return { error: null };
    },
    [projectId, assetId, templateKey, templateVersion, instance],
  );

  return { instance, loading, error, save };
}
