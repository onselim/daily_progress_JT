import { useState } from 'react';
import { useWorkItemsConfig } from '../lib/useProjectConfig';
import { useConstructionBreakdown } from '../lib/useConstructionBreakdown';
import { useDesignBreakdown } from '../lib/useDesignBreakdown';
import { useSupplyBreakdown } from '../lib/useSupplyBreakdown';
import { computeOverallPercent } from '../lib/overallProgress';
import { DesignPanel } from './DesignPanel';
import { SupplyPanel } from './SupplyPanel';

type Tab = 'overall' | 'design' | 'supply';

const TAB_COLOR = {
  overall: '#00d4aa',
  design: '#9333ea',
  supply: '#2563eb',
  construction: '#10b981',
};

interface ItemRow {
  key: string;
  label: string;
  percentComplete: number;
}

function ItemBar({ item, color }: { item: ItemRow; color: string }) {
  return (
    <div className="pgb-item-row">
      <span className={`pgb-item-lbl${item.percentComplete <= 0 ? ' pgb-item-lbl-muted' : ''}`}>{item.label}</span>
      <div className="pgb-item-track">
        <div className="pgb-item-fill" style={{ width: `${Math.min(item.percentComplete, 100)}%`, background: color }} />
      </div>
      <span className="pgb-item-val">{item.percentComplete.toFixed(1)}%</span>
    </div>
  );
}

interface ProjectProgressBarProps {
  projectId: string;
  editable: boolean;
}

export function ProjectProgressBar({ projectId, editable }: ProjectProgressBarProps) {
  const { workItems } = useWorkItemsConfig(projectId);
  const construction = useConstructionBreakdown(projectId, workItems);
  const design = useDesignBreakdown(projectId);
  const supply = useSupplyBreakdown(projectId);
  const overallPercent = computeOverallPercent(design.overallPercent, construction.overallPercent, supply.overallPercent);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  function toggle(tab: Tab) {
    setActiveTab((prev) => (prev === tab ? null : tab));
  }

  const constructionGroups: { name: string; items: ItemRow[] }[] = [];
  for (const item of construction.items) {
    const name = workItems.find((w) => w.key === item.key)?.group ?? 'Work items';
    let group = constructionGroups.find((g) => g.name === name);
    if (!group) {
      group = { name, items: [] };
      constructionGroups.push(group);
    }
    group.items.push(item);
  }

  return (
    <>
      <div className="pgb">
        <div className="pgb-tabs">
          <button
            type="button"
            className={`pgb-tab pgb-tab-overall${activeTab === 'overall' ? ' active' : ''}`}
            onClick={() => toggle('overall')}
          >
            <span className="pgb-tab-val" style={{ color: TAB_COLOR.overall }}>
              {overallPercent.toFixed(1)}%
            </span>
            <span className="pgb-tab-lbl">Overall</span>
          </button>
          <button type="button" className={`pgb-tab${activeTab === 'design' ? ' active' : ''}`} onClick={() => toggle('design')}>
            <span className="pgb-tab-val" style={{ color: TAB_COLOR.design }}>
              {design.overallPercent.toFixed(1)}%
            </span>
            <span className="pgb-tab-lbl">Design</span>
          </button>
          <button type="button" className={`pgb-tab${activeTab === 'supply' ? ' active' : ''}`} onClick={() => toggle('supply')}>
            <span className="pgb-tab-val" style={{ color: TAB_COLOR.supply }}>
              {supply.overallPercent.toFixed(1)}%
            </span>
            <span className="pgb-tab-lbl">Supply</span>
          </button>
          <div className="pgb-tab pgb-tab-static">
            <span className="pgb-tab-val" style={{ color: TAB_COLOR.construction }}>
              {construction.overallPercent.toFixed(1)}%
            </span>
            <span className="pgb-tab-lbl">Construction</span>
          </div>
        </div>

        {activeTab && (
          <div className="pgb-detail">
            {activeTab === 'overall' && (
              <div className="pgb-overall-summary">
                <div className="pgb-overall-section">
                  <div className="pgb-overall-section-title" style={{ color: TAB_COLOR.design }}>
                    Design — {design.overallPercent.toFixed(1)}%
                  </div>
                  {design.items.length === 0 ? (
                    <p className="accordion-empty">No design items configured for this project.</p>
                  ) : (
                    design.items.map((item) => <ItemBar key={item.key} item={item} color={TAB_COLOR.design} />)
                  )}
                </div>

                <div className="pgb-overall-section">
                  <div className="pgb-overall-section-title" style={{ color: TAB_COLOR.supply }}>
                    Supply — {supply.overallPercent.toFixed(1)}%
                  </div>
                  {supply.items.length === 0 ? (
                    <p className="accordion-empty">No supply items configured for this project.</p>
                  ) : (
                    supply.items.map((item) => <ItemBar key={item.key} item={item} color={TAB_COLOR.supply} />)
                  )}
                </div>

                <p className="pgb-overall-note">
                  Construction — {construction.overallPercent.toFixed(1)}% (see the full breakdown below the tabs)
                </p>
              </div>
            )}

            {activeTab === 'design' && (
              <DesignPanel
                projectId={projectId}
                editable={editable}
                items={design.items}
                overallPercent={design.overallPercent}
                loading={design.loading}
                onSaved={design.refresh}
              />
            )}

            {activeTab === 'supply' && (
              <SupplyPanel
                projectId={projectId}
                editable={editable}
                items={supply.items}
                overallPercent={supply.overallPercent}
                loading={supply.loading}
                onSaved={supply.refresh}
              />
            )}
          </div>
        )}
      </div>

      <div className="pgb-construction-strip">
        <div className="pgb-construction-strip-title" style={{ color: TAB_COLOR.construction }}>
          Construction
        </div>
        {constructionGroups.length === 0 ? (
          <span className="pgb-construction-strip-empty">No construction items configured for this project.</span>
        ) : (
          <div className="pgb-construction-groups-grid">
            {constructionGroups.map((group) => (
              <div key={group.name} className="pgb-construction-card">
                <div className="pgb-construction-card-title">{group.name}</div>
                <div className="pgb-construction-card-items">
                  {group.items.map((item) => (
                    <span key={item.key} className={`pgb-chip${item.percentComplete <= 0 ? ' pgb-chip-muted' : ''}`}>
                      {item.label} <strong>{item.percentComplete.toFixed(1)}%</strong>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
