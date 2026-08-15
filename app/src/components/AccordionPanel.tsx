import { useState, type ReactNode } from 'react';

interface AccordionPanelProps {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function AccordionPanel({ title, badge, defaultOpen = false, children }: AccordionPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="accordion-panel">
      <button type="button" className="accordion-header" onClick={() => setOpen((v) => !v)}>
        <span className="accordion-header-title">
          <span>{title}</span>
          {badge != null && <span className="accordion-badge">{badge}</span>}
        </span>
        <span className={`accordion-chevron${open ? ' open' : ''}`}>▸</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  );
}
