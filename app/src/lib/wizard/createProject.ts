import { supabase } from '../supabase';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'project';
  let slug = base;

  for (let suffix = 1; ; suffix += 1) {
    const { data } = await supabase.from('projects').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${suffix + 1}`;
  }
}

export interface ProjectBasicsInput {
  name: string;
  client: string;
  contractor: string;
  contractNo: string;
  industryType: string;
  utmZone: string;
  coordinateSystem: string;
  isPublic: boolean;
  voltage: string;
  circuitType: string;
  towerHeadType: string;
  conductorCount: number;
  conductorType: string;
  opgwCount: number;
  opgwType: string;
  earthwireCount: number;
  ewType: string;
  createdBy: string;
}

export async function createProject(input: ProjectBasicsInput) {
  const slug = await uniqueSlug(input.name);

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      slug,
      name: input.name,
      client: input.client || null,
      contractor: input.contractor || null,
      contract_no: input.contractNo || null,
      industry_type: input.industryType,
      utm_zone: input.utmZone || null,
      coordinate_system: input.coordinateSystem || null,
      is_public: input.isPublic,
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: configError } = await supabase.from('project_config').insert([
    { project_id: project.id, key: 'voltage', value: input.voltage },
    { project_id: project.id, key: 'circuit_type', value: input.circuitType },
    { project_id: project.id, key: 'tower_head_type', value: input.towerHeadType },
    { project_id: project.id, key: 'conductor_count', value: input.conductorCount },
    { project_id: project.id, key: 'conductor_type', value: input.conductorType },
    { project_id: project.id, key: 'opgw_type', value: input.opgwType },
    { project_id: project.id, key: 'earthwire_type', value: input.ewType },
    {
      project_id: project.id,
      key: 'ground_wire_config',
      value: { opgw: input.opgwCount, earthwire: input.earthwireCount },
    },
  ]);
  if (configError) throw configError;

  return project;
}
