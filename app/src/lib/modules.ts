import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { LanguageCode } from './i18n/languages';

/** Optional add-on modules a project can switch on in Admin → Modules. Map, daily progress and the report are core and always on. */
export interface ModuleDef {
  key: string;
  /** English / Turkish names (admin screens). */
  name: { en: string; tr: string };
  /** False = planned but not built yet: shown greyed out so admins see what is coming. */
  available: boolean;
  /** Document type that can have its own distribution list. */
  hasList: boolean;
}

export const MODULE_DEFS: ModuleDef[] = [
  { key: 'checklist.foundation', name: { en: 'Checklist — Foundation Works', tr: 'Kontrol listesi — Temel İşleri' }, available: true, hasList: true },
  { key: 'checklist.erection', name: { en: 'Checklist — Erection', tr: 'Kontrol listesi — Montaj' }, available: false, hasList: true },
  { key: 'checklist.stringing', name: { en: 'Checklist — Stringing', tr: 'Kontrol listesi — Tel çekimi' }, available: false, hasList: true },
  { key: 'checklist.opgw', name: { en: 'Checklist — OPGW', tr: 'Kontrol listesi — OPGW' }, available: false, hasList: true },
  { key: 'rfi', name: { en: 'RFI (Requests for Information)', tr: 'RFI (Bilgi talepleri)' }, available: false, hasList: true },
];

export function moduleName(def: ModuleDef, lang: LanguageCode): string {
  return lang === 'tr' ? def.name.tr : def.name.en;
}

export interface Person {
  name: string;
  email: string;
  title?: string;
}

/** Approvers of the Consultant and the Employer, plus an information (cc) list that only gets notified. */
export interface ListSet {
  consultant: Person[];
  employer: Person[];
  info: Person[];
}

export type ListKey = keyof ListSet;
export const LIST_KEYS: ListKey[] = ['consultant', 'employer', 'info'];

export interface DistributionLists {
  /** Used for every list a document type leaves empty. */
  default: ListSet;
  byType: Record<string, Partial<ListSet>>;
}

export const EMPTY_SET: ListSet = { consultant: [], employer: [], info: [] };

/** The lists that apply to one document type: its own list when it has people in it, else the project default. */
export function resolveLists(cfg: DistributionLists | null | undefined, typeKey: string): ListSet {
  const out: ListSet = { consultant: [], employer: [], info: [] };
  for (const k of LIST_KEYS) {
    const own = cfg?.byType?.[typeKey]?.[k];
    out[k] = own && own.length > 0 ? own : cfg?.default?.[k] ?? [];
  }
  return out;
}

export interface ProjectModulesState {
  enabled: Record<string, boolean>;
  lists: DistributionLists;
  loading: boolean;
  /** True once the admin has switched the module on for this project. Missing config = off. */
  isEnabled: (key: string) => boolean;
  reload: () => void;
}

export function useProjectModules(projectId: string | undefined): ProjectModulesState {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [lists, setLists] = useState<DistributionLists>({ default: { ...EMPTY_SET }, byType: {} });
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('project_config')
      .select('key, value')
      .eq('project_id', projectId)
      .in('key', ['enabled_modules', 'distribution_lists'])
      .then(({ data }) => {
        if (cancelled) return;
        const en = data?.find((r) => r.key === 'enabled_modules')?.value;
        const dl = data?.find((r) => r.key === 'distribution_lists')?.value as DistributionLists | undefined;
        setEnabled(en && typeof en === 'object' ? (en as Record<string, boolean>) : {});
        setLists({ default: { ...EMPTY_SET, ...(dl?.default ?? {}) }, byType: dl?.byType ?? {} });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, nonce]);

  const isEnabled = useCallback((key: string) => enabled[key] === true, [enabled]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { enabled, lists, loading, isEnabled, reload };
}

export async function saveProjectConfig(projectId: string, key: string, value: unknown): Promise<string | null> {
  const { error } = await supabase.from('project_config').upsert({ project_id: projectId, key, value }, { onConflict: 'project_id,key' });
  return error ? error.message : null;
}
