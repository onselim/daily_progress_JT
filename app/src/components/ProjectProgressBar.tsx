import { useState } from 'react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { TranslationKey } from '../lib/i18n/translations/en';
import { useWorkItemsConfig } from '../lib/useProjectConfig';
import { useConstructionBreakdown } from '../lib/useConstructionBreakdown';
import { useDesignBreakdown } from '../lib/useDesignBreakdown';
import { useSupplyBreakdown } from '../lib/useSupplyBreakdown';
import { useProjectWorkItemsProgress } from '../lib/useProjectWorkItemsProgress';
import { useAssetStats } from '../lib/useAssetStats';
import { computeOverallPercent } from '../lib/overallProgress';
import { computeGroupStatus } from '../lib/groupStatus';
import { DesignPanel } from './DesignPanel';
import { SupplyPanel } from './SupplyPanel';

type Tab = 'overall' | 'design' | 'supply' | 'construction';

const TAB_COLOR = {
  overall: '#00d4aa',
  design: '#9333ea',
  supply: '#2563eb',
  construction: '#10b981',
};

// Headline phases shown as tower-count stats (mirrors the validated prototype's topbar) —
// "how many of the 201 towers have fully finished this phase", not an averaged percentage.
// Pre-construction/soil-investigation items still count toward Construction% but aren't
// prominent enough on their own to earn a topbar stat.
const HEADLINE_GROUPS: { name: string; labelKey: TranslationKey; color: string }[] = [
  { name: 'FOUNDATION', labelKey: 'status.foundation', color: '#3b82f6' },
  { name: 'ERECTION', labelKey: 'status.erection', color: '#8b5cf6' },
  { name: 'STRINGING', labelKey: 'status.stringing', color: '#f59e0b' },
];

interface ItemRow {
  key: string;
  label: string;
  percentComplete: number;
}

function ItemBar({ item, color }: { item: ItemRow; color: string }) {
  const { tLabel, n } = useLanguage();
  return (
    <div className="pgb-item-row">
      <span className={`pgb-item-lbl${item.percentComplete <= 0 ? ' pgb-item-lbl-muted' : ''}`}>{tLabel(item.label)}</span>
      <div className="pgb-item-track">
        <div className="pgb-item-fill" style={{ width: `${Math.min(item.percentComplete, 100)}%`, background: color }} />
      </div>
      <span className="pgb-item-val">{n(item.percentComplete.toFixed(1))}%</span>
    </div>
  );
}

function ConstructionGroups({ groups, color }: { groups: { name: string; items: ItemRow[] }[]; color: string }) {
  const { t, tLabel } = useLanguage();
  if (groups.length === 0) return <p className="accordion-empty">{t('progress.noConstructionItems')}</p>;
  return (
    <>
      {groups.map((group) => (
        <div key={group.name} className="pgb-group">
          <div className="pgb-group-name">{tLabel(group.name)}</div>
          {group.items.map((item) => (
            <ItemBar key={item.key} item={item} color={color} />
          ))}
        </div>
      ))}
    </>
  );
}

interface ProjectProgressBarProps {
  projectId: string;
  projectSlug: string;
  editable: boolean;
  isAdmin: boolean;
}

export function ProjectProgressBar({ projectId, projectSlug, editable, isAdmin }: ProjectProgressBarProps) {
  const { t, n } = useLanguage();
  const { workItems } = useWorkItemsConfig(projectId);
  const construction = useConstructionBreakdown(projectId, workItems);
  const design = useDesignBreakdown(projectId);
  const supply = useSupplyBreakdown(projectId);
  const { percentByAssetAndKey } = useProjectWorkItemsProgress(projectId, workItems);
  const { stats } = useAssetStats(projectId);
  const overallPercent = computeOverallPercent(design.overallPercent, construction.overallPercent, supply.overallPercent);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  function toggle(tab: Tab) {
    setActiveTab((prev) => (prev === tab ? null : tab));
  }

  const constructionGroups: { name: string; items: ItemRow[] }[] = [];
  for (const item of construction.items) {
    const name = workItems.find((w) => w.key === item.key)?.group ?? t('assetEditor.workItems');
    let group = constructionGroups.find((g) => g.name === name);
    if (!group) {
      group = { name, items: [] };
      constructionGroups.push(group);
    }
    group.items.push(item);
  }

  const headlineCounts = HEADLINE_GROUPS.map((hg) => {
    const itemKeys = workItems.filter((w) => w.group === hg.name).map((w) => w.key);
    const done = Object.values(percentByAssetAndKey).filter(
      (percentByKey) => computeGroupStatus(itemKeys, percentByKey) === 'completed',
    ).length;
    return { ...hg, done };
  });

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
              {n(overallPercent.toFixed(1))}%
            </span>
            <span className="pgb-tab-lbl">{t('common.overall')}</span>
          </button>
          <button type="button" className={`pgb-tab${activeTab === 'design' ? ' active' : ''}`} onClick={() => toggle('design')}>
            <span className="pgb-tab-val" style={{ color: TAB_COLOR.design }}>
              {n(design.overallPercent.toFixed(1))}%
            </span>
            <span className="pgb-tab-lbl">{t('status.design')}</span>
          </button>
          <button type="button" className={`pgb-tab${activeTab === 'supply' ? ' active' : ''}`} onClick={() => toggle('supply')}>
            <span className="pgb-tab-val" style={{ color: TAB_COLOR.supply }}>
              {n(supply.overallPercent.toFixed(1))}%
            </span>
            <span className="pgb-tab-lbl">{t('status.supply')}</span>
          </button>
          <button
            type="button"
            className={`pgb-tab${activeTab === 'construction' ? ' active' : ''}`}
            onClick={() => toggle('construction')}
          >
            <span className="pgb-tab-val" style={{ color: TAB_COLOR.construction }}>
              {n(construction.overallPercent.toFixed(1))}%
            </span>
            <span className="pgb-tab-lbl">{t('status.construction')}</span>
          </button>
        </div>

        {activeTab && (
          <div className="pgb-detail">
            {activeTab === 'overall' && (
              <div className="pgb-overall-summary">
                <div className="pgb-overall-section">
                  <div className="pgb-overall-section-title" style={{ color: TAB_COLOR.design }}>
                    {t('progress.designLabel', { percent: n(design.overallPercent.toFixed(1)) })}
                  </div>
                  {design.items.length === 0 ? (
                    <p className="accordion-empty">{t('progress.noDesignItems')}</p>
                  ) : (
                    design.items.map((item) => <ItemBar key={item.key} item={item} color={TAB_COLOR.design} />)
                  )}
                </div>

                <div className="pgb-overall-section">
                  <div className="pgb-overall-section-title" style={{ color: TAB_COLOR.construction }}>
                    {t('progress.constructionLabel', { percent: n(construction.overallPercent.toFixed(1)) })}
                  </div>
                  <ConstructionGroups groups={constructionGroups} color={TAB_COLOR.construction} />
                </div>

                <div className="pgb-overall-section">
                  <div className="pgb-overall-section-title" style={{ color: TAB_COLOR.supply }}>
                    {t('progress.supplyLabel', { percent: n(supply.overallPercent.toFixed(1)) })}
                  </div>
                  {supply.items.length === 0 ? (
                    <p className="accordion-empty">{t('progress.noSupplyItems')}</p>
                  ) : (
                    supply.items.map((item) => <ItemBar key={item.key} item={item} color={TAB_COLOR.supply} />)
                  )}
                </div>
              </div>
            )}

            {activeTab === 'design' && (
              <DesignPanel
                projectId={projectId}
                projectSlug={projectSlug}
                editable={editable}
                isAdmin={isAdmin}
                items={design.items}
                overallPercent={design.overallPercent}
                loading={design.loading}
                onSaved={design.refresh}
              />
            )}

            {activeTab === 'supply' && (
              <SupplyPanel
                projectId={projectId}
                projectSlug={projectSlug}
                editable={editable}
                isAdmin={isAdmin}
                items={supply.items}
                overallPercent={supply.overallPercent}
                loading={supply.loading}
                onSaved={supply.refresh}
              />
            )}

            {activeTab === 'construction' && <ConstructionGroups groups={constructionGroups} color={TAB_COLOR.construction} />}
          </div>
        )}
      </div>

      <div className="pgb-headline-stats">
        {headlineCounts.map((hg) => (
          <span key={hg.name} className="stat-pill">
            <span className="stat-pill-dot" style={{ background: hg.color }} />
            <span className="stat-pill-val">
              {n(hg.done)}/{n(stats.total)}
            </span>
            <span className="stat-pill-lbl">{t(hg.labelKey)}</span>
          </span>
        ))}
      </div>
    </>
  );
}
