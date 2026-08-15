import { useParams } from 'react-router-dom';
import { useProjectBySlug } from '../lib/useProject';
import { useAssetStats } from '../lib/useAssetStats';
import { useRestrictedToday } from '../lib/useRestrictedToday';
import { useWorkItemsConfig } from '../lib/useProjectConfig';
import { useConstructionBreakdown } from '../lib/useConstructionBreakdown';
import { useDesignBreakdown } from '../lib/useDesignBreakdown';
import { useSupplyBreakdown } from '../lib/useSupplyBreakdown';
import { computeOverallPercent } from '../lib/overallProgress';
import { AssetWorkspace } from '../components/AssetWorkspace';

export default function PublicViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { project, loading, error } = useProjectBySlug(slug);
  const { stats } = useAssetStats(project?.id);
  const restrictedAssetIds = useRestrictedToday(project?.id);
  const { workItems } = useWorkItemsConfig(project?.id);
  const { overallPercent: constructionPercent } = useConstructionBreakdown(project?.id, workItems);
  const { overallPercent: designPercent } = useDesignBreakdown(project?.id);
  const { overallPercent: supplyPercent } = useSupplyBreakdown(project?.id);
  const overallPercent = computeOverallPercent(designPercent, constructionPercent, supplyPercent);

  if (loading) return <div className="page-loading">Loading…</div>;

  if (error || !project) {
    return (
      <div className="page-loading">
        <p>This project report is not available.</p>
      </div>
    );
  }

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <h1>{project.name}</h1>
          {project.client && <p>{project.client}</p>}
        </div>
        <div className="project-topbar-stats">
          <span className="stat-pill stat-pill-overall">
            <span className="stat-pill-val">{overallPercent.toFixed(1)}%</span>
            <span className="stat-pill-lbl">Overall</span>
          </span>
          <span className="stat-pill">
            <span className="stat-pill-dot" style={{ background: '#00d4aa' }} />
            <span className="stat-pill-val">{stats.inProgress}</span>
            <span className="stat-pill-lbl">Active</span>
          </span>
          <span className="stat-pill">
            <span className="stat-pill-dot" style={{ background: '#ef4444' }} />
            <span className="stat-pill-val">{restrictedAssetIds.size}</span>
            <span className="stat-pill-lbl">No Access</span>
          </span>
          <span className="stat-pill">
            <span className="stat-pill-dot" style={{ background: '#3b82f6' }} />
            <span className="stat-pill-val">{stats.completed}</span>
            <span className="stat-pill-lbl">Completed</span>
          </span>
          <span className="stat-pill">
            <span className="stat-pill-dot" style={{ background: '#3d4259' }} />
            <span className="stat-pill-val">{stats.total}</span>
            <span className="stat-pill-lbl">Towers</span>
          </span>
        </div>
        <button type="button" onClick={() => window.open(`/print/${project.slug}`, '_blank')}>
          Print PDF
        </button>
      </header>

      <AssetWorkspace projectId={project.id} coordinateSystem={project.coordinate_system} editable={false} />
    </div>
  );
}
