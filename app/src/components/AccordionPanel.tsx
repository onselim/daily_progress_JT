import { useState, type ReactNode } from 'react';

interface AccordionPanelProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function AccordionPanel({ title, defaultOpen = false, children }: AccordionPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="accordion-panel">
      <button type="button" className="accordion-header" onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className={`accordion-chevron${open ? ' open' : ''}`}>▸</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  );
}
