import { useState, type ChangeEvent } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useProjectDocuments } from '../lib/useProjectDocuments';
import { uploadProjectDocument } from '../lib/uploadProjectDocument';

interface ProjectDocumentsPanelProps {
  projectId: string;
  editable: boolean;
}

export function ProjectDocumentsPanel({ projectId, editable }: ProjectDocumentsPanelProps) {
  const { user } = useAuth();
  const { documents, loading, refresh } = useProjectDocuments(projectId);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      await uploadProjectDocument({ projectId, file, uploadedBy: user.id });
      await refresh();
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  if (loading) return <p className="accordion-empty">Loading…</p>;

  return (
    <>
      {documents.length === 0 && <p className="accordion-empty">No documents uploaded yet.</p>}
      {documents.map((doc) => (
        <div key={doc.id} className="doc-row">
          <span>{doc.slot_name}</span>
          <a href={doc.file_url} target="_blank" rel="noreferrer">
            Open ↗
          </a>
        </div>
      ))}
      {editable && (
        <label className="photo-upload-label" style={{ marginTop: 8 }}>
          {uploading ? 'Uploading…' : '+ Add document'}
          <input type="file" onChange={handleUpload} disabled={uploading} />
        </label>
      )}
    </>
  );
}
