import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useProjectDocuments } from '../lib/useProjectDocuments';
import { uploadProjectDocument } from '../lib/uploadProjectDocument';
import { deleteProjectDocument } from '../lib/deleteProjectDocument';
import { createDocumentFolder, deleteDocumentFolder } from '../lib/documentFolders';

interface ProjectDocumentsPanelProps {
  projectId: string;
  editable: boolean;
}

export function ProjectDocumentsPanel({ projectId, editable }: ProjectDocumentsPanelProps) {
  const { user } = useAuth();
  const { documents, folders, loading, refresh } = useProjectDocuments(projectId);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>, folderId: string | null) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingKey(folderId ?? 'root');
    try {
      await uploadProjectDocument({ projectId, file, uploadedBy: user.id, folderId });
      await refresh();
    } finally {
      setUploadingKey(null);
      e.target.value = '';
    }
  }

  async function handleDeleteDocument(docId: string, fileUrl: string) {
    await deleteProjectDocument(docId, fileUrl);
    await refresh();
  }

  async function handleCreateFolder(e: FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim() || !user) return;
    setCreatingFolder(true);
    try {
      await createDocumentFolder(projectId, newFolderName, user.id);
      setNewFolderName('');
      setAddingFolder(false);
      await refresh();
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleDeleteFolder(folderId: string, folderName: string) {
    if (!confirm(`Delete folder "${folderName}" and every file in it?`)) return;
    await deleteDocumentFolder(folderId);
    await refresh();
  }

  if (loading) return <p className="accordion-empty">Loading…</p>;

  const rootDocs = documents.filter((d) => d.folder_id === null);

  return (
    <>
      {folders.length === 0 && rootDocs.length === 0 && (
        <p className="accordion-empty">No documents uploaded yet.</p>
      )}

      {folders.map((folder) => {
        const folderDocs = documents.filter((d) => d.folder_id === folder.id);
        const open = openFolders[folder.id] ?? false;
        return (
          <div key={folder.id} className="doc-folder">
            <div className="doc-folder-header-row">
              <button
                type="button"
                className="doc-folder-header"
                onClick={() => setOpenFolders((prev) => ({ ...prev, [folder.id]: !open }))}
              >
                <span className={`accordion-chevron${open ? ' open' : ''}`}>▸</span>
                <span className="doc-folder-name">{folder.name}</span>
                <span className="doc-folder-count">{folderDocs.length}</span>
              </button>
              {editable && (
                <button
                  type="button"
                  className="items-editor-remove-btn"
                  onClick={() => handleDeleteFolder(folder.id, folder.name)}
                  title="Delete folder"
                >
                  ×
                </button>
              )}
            </div>
            {open && (
              <div className="doc-folder-body">
                {folderDocs.length === 0 && <p className="accordion-empty">No files in this folder yet.</p>}
                {folderDocs.map((doc) => (
                  <div key={doc.id} className="doc-row">
                    <a href={doc.file_url} target="_blank" rel="noreferrer">
                      {doc.slot_name}
                    </a>
                    {editable && (
                      <button
                        type="button"
                        className="items-editor-remove-btn"
                        onClick={() => handleDeleteDocument(doc.id, doc.file_url)}
                        title="Delete file"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {editable && (
                  <label className="photo-upload-label photo-upload-label-sm">
                    {uploadingKey === folder.id ? 'Uploading…' : '+ Add file'}
                    <input
                      type="file"
                      onChange={(e) => handleUpload(e, folder.id)}
                      disabled={uploadingKey === folder.id}
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}

      {rootDocs.length > 0 && (
        <div className="doc-folder-body doc-folder-root">
          {rootDocs.map((doc) => (
            <div key={doc.id} className="doc-row">
              <a href={doc.file_url} target="_blank" rel="noreferrer">
                {doc.slot_name}
              </a>
              {editable && (
                <button
                  type="button"
                  className="items-editor-remove-btn"
                  onClick={() => handleDeleteDocument(doc.id, doc.file_url)}
                  title="Delete file"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editable && (
        <div className="doc-actions-row">
          <label className="photo-upload-label">
            {uploadingKey === 'root' ? 'Uploading…' : '+ Add document'}
            <input type="file" onChange={(e) => handleUpload(e, null)} disabled={uploadingKey === 'root'} />
          </label>

          {addingFolder ? (
            <form className="doc-folder-add-form" onSubmit={handleCreateFolder}>
              <input
                type="text"
                autoFocus
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
              <button className="doc-form-btn" type="submit" disabled={creatingFolder || !newFolderName.trim()}>
                {creatingFolder ? '…' : 'Create'}
              </button>
              <button
                className="doc-form-btn"
                type="button"
                onClick={() => {
                  setAddingFolder(false);
                  setNewFolderName('');
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" className="doc-folder-add-btn" onClick={() => setAddingFolder(true)}>
              + Add folder
            </button>
          )}
        </div>
      )}
    </>
  );
}
