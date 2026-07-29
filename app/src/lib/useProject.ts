import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  client: string | null;
  contractor: string | null;
  contract_no: string | null;
  industry_type: string;
  utm_zone: string | null;
  coordinate_system: string | null;
  is_public: boolean;
  is_active: boolean;
}

export function useProjectBySlug(slug: string | undefined) {
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('projects')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error.message);
        setProject(data);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { project, loading, error };
}
