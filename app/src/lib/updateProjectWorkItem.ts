import { supabase } from './supabase';

interface UpdateProjectWorkItemInput {
  projectId: string;
  category: 'design' | 'supply';
  workItemKey: string;
  percentComplete: number;
  status: string;
  updatedBy: string;
}

export async function updateProjectWorkItem({
  projectId,
  category,
  workItemKey,
  percentComplete,
  status,
  updatedBy,
}: UpdateProjectWorkItemInput) {
  const { error } = await supabase.from('project_work_items').upsert(
    {
      project_id: projectId,
      category,
      work_item_key: workItemKey,
      percent_complete: percentComplete,
      status,
      updated_by: updatedBy,
    },
    { onConflict: 'project_id,category,work_item_key' },
  );
  if (error) throw error;
}
