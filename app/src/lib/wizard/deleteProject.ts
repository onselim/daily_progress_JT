import { supabase } from '../supabase';

const BUCKET = 'project-media';

async function listAllFiles(prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error || !data) return [];

  const files: string[] = [];
  for (const item of data) {
    const itemPath = `${prefix}/${item.name}`;
    if (item.id === null) {
      files.push(...(await listAllFiles(itemPath)));
    } else {
      files.push(itemPath);
    }
  }
  return files;
}

export async function deleteProject(projectId: string) {
  try {
    const files = await listAllFiles(projectId);
    for (let i = 0; i < files.length; i += 100) {
      await supabase.storage.from(BUCKET).remove(files.slice(i, i + 100));
    }
  } catch {
    // Storage cleanup is best-effort — never block the actual project
    // deletion on it. Any orphaned files are a minor cost, not a correctness
    // issue.
  }

  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}
