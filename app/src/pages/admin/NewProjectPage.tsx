import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProjectBasicsStep } from '../../components/wizard/ProjectBasicsStep';
import { WorkItemsStep } from '../../components/wizard/WorkItemsStep';
import { AssetImportStep } from '../../components/wizard/AssetImportStep';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import type { ProjectRow } from '../../lib/useProject';

type Step = 1 | 2 | 3;

export default function NewProjectPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  const [project, setProject] = useState<ProjectRow | null>(null);

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to="/admin">{t('topbar.backToProjects')}</Link>
          <h1>{t('wizard.newProject')}</h1>
        </div>
      </header>

      <div className="wizard-page">
        <div className="wizard-steps">
          <span className={step === 1 ? 'active' : ''}>{t('wizard.stepBasics')}</span>
          <span className={step === 2 ? 'active' : ''}>{t('wizard.stepWorkItems')}</span>
          <span className={step === 3 ? 'active' : ''}>{t('wizard.stepImport')}</span>
        </div>

        {step === 1 && (
          <ProjectBasicsStep
            onComplete={(p) => {
              setProject(p);
              setStep(2);
            }}
          />
        )}

        {step === 2 && project && (
          <WorkItemsStep projectId={project.id} onBack={() => setStep(1)} onComplete={() => setStep(3)} />
        )}

        {step === 3 && project && (
          <AssetImportStep
            project={project}
            onBack={() => setStep(2)}
            onComplete={() => navigate(`/admin/${project.slug}`)}
          />
        )}
      </div>
    </div>
  );
}
