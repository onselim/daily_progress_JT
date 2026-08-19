import { useState, type ReactNode } from 'react';

interface RenamableTextProps {
  value: string;
  editable: boolean;
  onRename: (newValue: string) => void | Promise<void>;
  children: ReactNode;
}

/** Wraps a folder/file name so admin users can right-click it to rename in place
 * (Enter/blur saves, Escape cancels) instead of a separate rename dialog. */
export function RenamableText({ value, editable, onRename, children }: RenamableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editable) return <>{children}</>;

  if (editing) {
    return (
      <input
        type="text"
        className="rename-input"
        autoFocus
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== value) {
      onRename(trimmed);
    } else {
      setDraft(value);
    }
  }

  return (
    <span
      className="renamable-text"
      title="Right-click to rename"
      onContextMenu={(e) => {
        e.preventDefault();
        setDraft(value);
        setEditing(true);
      }}
    >
      {children}
    </span>
  );
}
