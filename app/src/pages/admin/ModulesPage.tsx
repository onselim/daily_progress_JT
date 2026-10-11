import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useProjectBySlug } from '../../lib/useProject';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { LIST_KEYS, MODULE_DEFS, moduleName, saveProjectConfig, useProjectModules, type DistributionLists, type ListKey, type Person } from '../../lib/modules';
import '../../components/checklists/checklist.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TXT = {
  title: { en: 'Modules & distribution lists', tr: 'Modüller ve dağıtım listeleri' },
  back: { en: '← Back to project', tr: '← Projeye dön' },
  modulesH: { en: 'Modules of this project', tr: 'Bu projenin modülleri' },
  modulesHint: {
    en: 'Switch on only what this project uses. A module that is off does not appear anywhere in the project and is refused by the server. Map, daily progress and the report are always on.',
    tr: 'Yalnızca bu projede kullanılacakları açın. Kapalı modül projede hiçbir yerde görünmez, sunucu da onu reddeder. Harita, günlük ilerleme ve rapor her zaman açıktır.',
  },
  soon: { en: 'coming soon', tr: 'yakında' },
  listsH: { en: 'Who receives what', tr: 'Kime ne gider' },
  listsHint: {
    en: 'Approvers get a personal link and must answer; Consultant and Employer both have to approve. The information (cc) list only gets notified when a stage is submitted and when it is fully approved. A document type with an empty list uses the "Default" list.',
    tr: 'Onaylayacaklar kişiye özel bir link alır ve cevap vermelidir; Müşavir ve İşveren ikisi de onaylamalıdır. Bilgi (CC) listesi yalnızca aşama gönderilince ve tamamen onaylanınca haberdar edilir. Listesi boş olan belge türü "Varsayılan" listeyi kullanır.',
  },
  scope: { en: 'Document type', tr: 'Belge türü' },
  def: { en: 'Default (all types)', tr: 'Varsayılan (tüm türler)' },
  consultant: { en: 'Consultant — approvers', tr: 'Müşavir — onaylayanlar' },
  employer: { en: 'Employer — approvers', tr: 'İşveren — onaylayanlar' },
  info: { en: 'Information (cc) — notified only', tr: 'Bilgi (CC) — yalnızca haberdar edilir' },
  name: { en: 'Name', tr: 'Ad' },
  email: { en: 'E-mail', tr: 'E-posta' },
  titleCol: { en: 'Title (optional)', tr: 'Unvan (isteğe bağlı)' },
  add: { en: '+ Add person', tr: '+ Kişi ekle' },
  remove: { en: 'Remove', tr: 'Kaldır' },
  save: { en: 'Save lists', tr: 'Listeleri kaydet' },
  saved: { en: 'Saved.', tr: 'Kaydedildi.' },
  badEmail: { en: 'Please fix the e-mail addresses marked in red.', tr: 'Kırmızı işaretli e-posta adreslerini düzeltin.' },
  inherits: { en: 'Empty = uses the default list', tr: 'Boş = varsayılan liste kullanılır' },
} as const;

export default function ModulesPage() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useLanguage();
  const tx = (k: keyof typeof TXT) => (language === 'tr' ? TXT[k].tr : TXT[k].en);
  const { project, loading: projectLoading } = useProjectBySlug(slug);
  const { enabled, lists, loading, reload } = useProjectModules(project?.id);
  const [draft, setDraft] = useState<DistributionLists>(lists);
  const [scope, setScope] = useState('default');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(lists), [lists]);

  if (projectLoading || loading || !project) return <div className="page-loading">…</div>;

  async function toggleModule(key: string, on: boolean) {
    setBusy(true);
    const err = await saveProjectConfig(project!.id, 'enabled_modules', { ...enabled, [key]: on });
    setMessage(err ?? tx('saved'));
    setBusy(false);
    reload();
  }

  const typeKeys = MODULE_DEFS.filter((m) => m.hasList && m.available && enabled[m.key] === true);
  const current = scope === 'default' ? draft.default : draft.byType[scope] ?? {};

  function setList(list: ListKey, people: Person[]) {
    setDraft((d) => (scope === 'default' ? { ...d, default: { ...d.default, [list]: people } } : { ...d, byType: { ...d.byType, [scope]: { ...d.byType[scope], [list]: people } } }));
  }

  async function saveLists() {
    const all = [...LIST_KEYS.flatMap((k) => draft.default[k] ?? []), ...Object.values(draft.byType).flatMap((s) => LIST_KEYS.flatMap((k) => s[k] ?? []))];
    if (all.some((p) => !EMAIL_RE.test(p.email.trim()))) {
      setMessage(tx('badEmail'));
      return;
    }
    // Keep storage tidy: trim, drop empty rows.
    const clean = (arr: Person[] = []) => arr.map((p) => ({ name: p.name.trim(), email: p.email.trim().toLowerCase(), ...(p.title?.trim() ? { title: p.title.trim() } : {}) })).filter((p) => p.email);
    const out: DistributionLists = {
      default: { consultant: clean(draft.default.consultant), employer: clean(draft.default.employer), info: clean(draft.default.info) },
      byType: Object.fromEntries(Object.entries(draft.byType).map(([k, s]) => [k, { consultant: clean(s.consultant), employer: clean(s.employer), info: clean(s.info) }])),
    };
    setBusy(true);
    const err = await saveProjectConfig(project!.id, 'distribution_lists', out);
    setMessage(err ?? tx('saved'));
    setBusy(false);
    if (!err) reload();
  }

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to={`/admin/${project.slug}`}>{tx('back')}</Link>
          <h1>{tx('title')}</h1>
          <p>{project.name}</p>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="wizard-page">
        <div className="wizard-form">
          <h2>{tx('modulesH')}</h2>
          <p className="wizard-hint">{tx('modulesHint')}</p>
          <fieldset className="wizard-fieldset">
            {MODULE_DEFS.map((m) => (
              <label key={m.key} className="ck-module-row" style={{ opacity: m.available ? 1 : 0.5 }}>
                <input type="checkbox" checked={enabled[m.key] === true} disabled={busy || !m.available} onChange={(e) => void toggleModule(m.key, e.target.checked)} />
                <span>
                  {moduleName(m, language)}
                  {!m.available && <em> — {tx('soon')}</em>}
                </span>
              </label>
            ))}
          </fieldset>

          <h2 style={{ marginTop: 32 }}>{tx('listsH')}</h2>
          <p className="wizard-hint">{tx('listsHint')}</p>
          <label className="ck-printlang" style={{ marginBottom: 12 }}>
            {tx('scope')}
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="default">{tx('def')}</option>
              {typeKeys.map((m) => (
                <option key={m.key} value={m.key}>
                  {moduleName(m, language)}
                </option>
              ))}
            </select>
          </label>
          {scope !== 'default' && <p className="wizard-hint">{tx('inherits')}</p>}

          {LIST_KEYS.map((list) => {
            const people = (current as Partial<Record<ListKey, Person[]>>)[list] ?? [];
            return (
              <fieldset className="wizard-fieldset" key={list}>
                <legend>{tx(list)}</legend>
                {people.map((p, i) => (
                  <div key={i} className="ck-person-row">
                    <input placeholder={tx('name')} value={p.name} onChange={(e) => setList(list, people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <input
                      placeholder={tx('email')}
                      value={p.email}
                      style={p.email && !EMAIL_RE.test(p.email.trim()) ? { borderColor: '#dc2626' } : undefined}
                      onChange={(e) => setList(list, people.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                    />
                    <input placeholder={tx('titleCol')} value={p.title ?? ''} onChange={(e) => setList(list, people.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                    <button type="button" className="items-editor-remove-btn" onClick={() => setList(list, people.filter((_, j) => j !== i))}>
                      {tx('remove')}
                    </button>
                  </div>
                ))}
                <button type="button" className="wizard-secondary-btn" onClick={() => setList(list, [...people, { name: '', email: '' }])}>
                  {tx('add')}
                </button>
              </fieldset>
            );
          })}

          <div className="ck-actions" style={{ marginTop: 12 }}>
            <button type="button" className="ck-save" disabled={busy} onClick={() => void saveLists()}>
              {tx('save')}
            </button>
            <span className="ck-msg">{message}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
