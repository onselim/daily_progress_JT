import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

export type ProjectRole = 'admin' | 'field_engineer' | 'viewer';

export interface ProjectRoleRow {
  project_id: string;
  role: ProjectRole;
  project: { slug: string; name: string };
}

export function useProjectRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<ProjectRoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('user_project_roles')
      .select('project_id, role, project:projects(slug, name)')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setRoles(data as unknown as ProjectRoleRow[]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { roles, loading };
}
