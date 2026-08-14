import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProjectBasicsStep } from '../../components/wizard/ProjectBasicsStep';
import { WorkItemsStep } from '../../components/wizard/WorkItemsStep';
import { AssetImportStep } from '../../components/wizard/AssetImportStep';
import type { ProjectRow } from '../../lib/useProject';

type Step = 1 | 2 | 3;

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [project, setProject] = useState<ProjectRow | null>(null);

  return (
    <div className="project-shell">
      <header className="project-topbar">
        <div className="project-topbar-left">
          <Link to="/admin">← Projects</Link>
          <h1>New project</h1>
        </div>
      </header>

      <div className="wizard-page">
        <div className="wizard-steps">
          <span className={step === 1 ? 'active' : ''}>1. Basics</span>
          <span className={step === 2 ? 'active' : ''}>2. Work items</span>
          <span className={step === 3 ? 'active' : ''}>3. Import</span>
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
            projectId={project.id}
            onBack={() => setStep(2)}
            onComplete={() => navigate(`/admin/${project.slug}`)}
          />
        )}
      </div>
    </div>
  );
}
