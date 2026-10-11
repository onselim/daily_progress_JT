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

  /** Creates the row on first save, updates it afterwards. Approval state (`gates`) is never sent from here: only the
   * approval workflow (Edge Functions, service role) may change it, so saving can never overwrite an approval. */
  const save = useCallback(
    async (payload: { data: ChecklistData; doc_no: string; rev: string }, event: { action: string; detail?: Record<string, unknown> }) => {
      if (!projectId || !assetId) return { error: 'No tower', id: null as string | null };
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
        ...(instance ? {} : { created_by: userId }),
      };
      const { data, error: err } = await supabase
        .from('checklist_instances')
        .upsert(row, { onConflict: 'asset_id,template_key' })
        .select(COLUMNS)
        .single();
      if (err || !data) return { error: err?.message ?? 'Save failed', id: null as string | null };
      setInstance(data as ChecklistInstance);
      await supabase.from('checklist_events').insert({ instance_id: data.id, user_id: userId, action: event.action, detail: event.detail ?? {} });
      return { error: null, id: data.id as string };
    },
    [projectId, assetId, templateKey, templateVersion, instance],
  );

  /** Re-reads the row (approvals made through the e-mail links show up here). */
  const reload = useCallback(async () => {
    if (!assetId) return;
    const { data } = await supabase.from('checklist_instances').select(COLUMNS).eq('asset_id', assetId).eq('template_key', templateKey).maybeSingle();
    if (data) setInstance(data as ChecklistInstance);
  }, [assetId, templateKey]);

  /** Submits (or re-sends) one approval stage: the Edge Function marks it submitted and e-mails the Consultant / Employer contacts. */
  const notifyGate = useCallback(async (instanceId: string, gate: string): Promise<{ error: string | null; sent: string[]; missing: string[] }> => {
    const { data, error: err } = await supabase.functions.invoke('checklist-notify', { body: { instanceId, gate } });
    if (err) {
      let msg = err.message;
      const ctx = (err as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const body = await ctx.json();
          if (body?.error) msg = String(body.error);
        } catch {
          /* keep the generic message */
        }
      }
      return { error: msg, sent: [], missing: [] };
    }
    return { error: null, sent: (data?.sent as string[]) ?? [], missing: (data?.missing as string[]) ?? [] };
  }, []);

  /** Admin only: reopens an approval stage (approvals and pending e-mail links are voided). */
  const resetGate = useCallback(async (instanceId: string, gate: string): Promise<string | null> => {
    const { error: err } = await supabase.rpc('checklist_reset_gate', { p_instance_id: instanceId, p_gate: gate });
    return err ? err.message : null;
  }, []);

  /** Admin only (database policy): deletes the whole checklist with its approvals and audit trail. */
  const deleteChecklist = useCallback(async (instanceId: string): Promise<string | null> => {
    const { error: err } = await supabase.from('checklist_instances').delete().eq('id', instanceId);
    if (err) return err.message;
    setInstance(null);
    return null;
  }, []);

  return { instance, loading, error, save, reload, notifyGate, resetGate, deleteChecklist };
}
