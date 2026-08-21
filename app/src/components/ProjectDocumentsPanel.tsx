import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useProjectDocuments, type DocumentFolder, type ProjectDocument } from '../lib/useProjectDocuments';
import { uploadProjectDocument } from '../lib/uploadProjectDocument';
import { deleteProjectDocument } from '../lib/deleteProjectDocument';
import { renameProjectDocument } from '../lib/renameDocument';
import { createDocumentFolder, deleteDocumentFolder, renameDocumentFolder } from '../lib/documentFolders';
import {
  computeProjectBounds,
  fetchExistingPowerAndPipelines,
  fetchExistingSubstationsAndPlants,
  fetchExistingRailways,
} from '../lib/fetchOsmInfrastructure';
import type { AssetListItem } from '../lib/useAssets';
import { RenamableText } from './RenamableText';

const GEO_LAYER_EXTENSIONS = /\.(geojson|json)$/i;

// Re-fetching replaces any previously-fetched file with this exact name rather than
// piling up duplicates each time the admin clicks the button again.
const OSM_LAYER_NAMES = {
  powerLines: 'Existing Power Lines (OSM).geojson',
  pipelines: 'Existing Pipelines (OSM).geojson',
  substations: 'Existing Substations & Plants (OSM).geojson',
  railways: 'Existing Railways (OSM).geojson',
};

interface ProjectDocumentsPanelProps {
  projectId: string;
  editable: boolean;
  section?: string;
  emptyLabel?: string;
  enabledLayerIds?: Set<string>;
  onToggleLayer?: (layerId: string) => void;
  layerErrors?: Record<string, string>;
  osmFetchContext?: { assets: AssetListItem[]; coordinateSystem: string | null };
}

interface FolderNodeProps {
  folder: DocumentFolder;
  depth: number;
  allFolders: DocumentFolder[];
  allDocuments: ProjectDocument[];
  editable: boolean;
  uploadingKey: string | null;
  onUpload: (e: ChangeEvent<HTMLInputElement>, folderId: string) => void;
  onDeleteDocument: (docId: string, fileUrl: string) => void;
  onCreateSubfolder: (name: string, parentFolderId: string) => Promise<void>;
  onDeleteFolder: (folderId: string, folderName: string) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onRenameDocument: (docId: string, newName: string) => void;
  enabledLayerIds?: Set<string>;
  onToggleLayer?: (layerId: string) => void;
  layerErrors?: Record<string, string>;
}

function LayerToggle({
  doc,
  enabledLayerIds,
  onToggleLayer,
  layerErrors,
}: {
  doc: ProjectDocument;
  enabledLayerIds?: Set<string>;
  onToggleLayer?: (layerId: string) => void;
  layerErrors?: Record<string, string>;
}) {
  if (!onToggleLayer || !GEO_LAYER_EXTENSIONS.test(doc.slot_name)) return null;
  const error = layerErrors?.[doc.id];
  return (
    <>
      <label
        className="layer-toggle"
        title={error ? `Couldn't show this layer: ${error}` : 'Show/hide this layer on the map'}
      >
        <input
          type="checkbox"
          checked={enabledLayerIds?.has(doc.id) ?? false}
          onChange={() => onToggleLayer(doc.id)}
        />
      </label>
      {error && enabledLayerIds?.has(doc.id) && <span className="layer-toggle-error">⚠</span>}
    </>
  );
}

function FolderNode({
  folder,
  depth,
  allFolders,
  allDocuments,
  editable,
  uploadingKey,
  onUpload,
  onDeleteDocument,
  onCreateSubfolder,
  onDeleteFolder,
  onRenameFolder,
  onRenameDocument,
  enabledLayerIds,
  onToggleLayer,
  layerErrors,
}: FolderNodeProps) {
  const [open, setOpen] = useState(false);
  const [addingSubfolder, setAddingSubfolder] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const children = allFolders.filter((f) => f.parent_folder_id === folder.id);
  const docs = allDocuments.filter((d) => d.folder_id === folder.id);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreateSubfolder(newName, folder.id);
      setNewName('');
      setAddingSubfolder(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="doc-folder" style={depth > 0 ? { marginLeft: 16 } : undefined}>
      <div className="doc-folder-header-row">
        <div
          className="doc-folder-header"
          role="button"
          tabIndex={0}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen((v) => !v);
            }
          }}
        >
          <span className={`accordion-chevron${open ? ' open' : ''}`}>▸</span>
          <RenamableText value={folder.name} editable={editable} onRename={(name) => onRenameFolder(folder.id, name)}>
            <span className="doc-folder-name">{folder.name}</span>
          </RenamableText>
          <span className="doc-folder-count">{docs.length}</span>
        </div>
        {editable && (
          <button
            type="button"
            className="items-editor-remove-btn"
            onClick={() => onDeleteFolder(folder.id, folder.name)}
            title="Delete folder"
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="doc-folder-body">
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              allFolders={allFolders}
              allDocuments={allDocuments}
              editable={editable}
              uploadingKey={uploadingKey}
              onUpload={onUpload}
              onDeleteDocument={onDeleteDocument}
              onCreateSubfolder={onCreateSubfolder}
              onDeleteFolder={onDeleteFolder}
              onRenameFolder={onRenameFolder}
              onRenameDocument={onRenameDocument}
              enabledLayerIds={enabledLayerIds}
              onToggleLayer={onToggleLayer}
              layerErrors={layerErrors}
            />
          ))}

          {docs.length === 0 && children.length === 0 && <p className="accordion-empty">Empty.</p>}

          {docs.map((doc) => (
            <div key={doc.id} className="doc-row">
              <span className="doc-row-main">
                <LayerToggle doc={doc} enabledLayerIds={enabledLayerIds} onToggleLayer={onToggleLayer} layerErrors={layerErrors} />
                <RenamableText
                  value={doc.slot_name}
                  editable={editable}
                  onRename={(name) => onRenameDocument(doc.id, name)}
                >
                  <a href={doc.file_url} target="_blank" rel="noreferrer">
                    {doc.slot_name}
                  </a>
                </RenamableText>
              </span>
              {editable && (
                <button
                  type="button"
                  className="items-editor-remove-btn"
                  onClick={() => onDeleteDocument(doc.id, doc.file_url)}
                  title="Delete file"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {editable && (
            <div className="doc-actions-row">
              <label className="photo-upload-label photo-upload-label-sm">
                {uploadingKey === folder.id ? 'Uploading…' : '+ Add file'}
                <input
                  type="file"
                  multiple
                  onChange={(e) => onUpload(e, folder.id)}
                  disabled={uploadingKey === folder.id}
                />
              </label>

              {addingSubfolder ? (
                <form className="doc-folder-add-form" onSubmit={handleCreate}>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Folder name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <button className="doc-form-btn" type="submit" disabled={creating || !newName.trim()}>
                    {creating ? '…' : 'Create'}
                  </button>
                  <button
                    className="doc-form-btn"
                    type="button"
                    onClick={() => {
                      setAddingSubfolder(false);
                      setNewName('');
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button type="button" className="doc-folder-add-btn" onClick={() => setAddingSubfolder(true)}>
                  + Add subfolder
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectDocumentsPanel({
  projectId,
  editable,
  section = 'documents',
  emptyLabel = 'No documents uploaded yet.',
  enabledLayerIds,
  onToggleLayer,
  layerErrors,
  osmFetchContext,
}: ProjectDocumentsPanelProps) {
  const { user } = useAuth();
  const { documents, folders, loading, refresh } = useProjectDocuments(projectId, section);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [fetchingOsm, setFetchingOsm] = useState(false);
  const [osmFetchError, setOsmFetchError] = useState<string | null>(null);

  async function replaceNamedDocument(name: string, geojson: GeoJSON.FeatureCollection) {
    if (!user || geojson.features.length === 0) return;
    const existing = documents.find((d) => d.slot_name === name);
    if (existing) await deleteProjectDocument(existing.id, existing.file_url);
    const file = new File([JSON.stringify(geojson)], name, { type: 'application/geo+json' });
    await uploadProjectDocument({ projectId, file, uploadedBy: user.id, folderId: null, section, slotName: name });
  }

  async function handleFetchOsmLayers() {
    if (!osmFetchContext || !user) return;
    setFetchingOsm(true);
    setOsmFetchError(null);
    try {
      const bounds = computeProjectBounds(osmFetchContext.assets, osmFetchContext.coordinateSystem);
      if (!bounds) throw new Error('No tower coordinates to search around yet.');

      // Sequential, not Promise.all -- the free public Overpass instance only allows a
      // couple of concurrent requests per IP and returns 429 if that's exceeded, which
      // firing all three queries at once reliably tripped.
      const { powerLines, pipelines } = await fetchExistingPowerAndPipelines(bounds);
      const substations = await fetchExistingSubstationsAndPlants(bounds);
      const railways = await fetchExistingRailways(bounds);

      await Promise.all([
        replaceNamedDocument(OSM_LAYER_NAMES.powerLines, powerLines),
        replaceNamedDocument(OSM_LAYER_NAMES.pipelines, pipelines),
        replaceNamedDocument(OSM_LAYER_NAMES.substations, substations),
        replaceNamedDocument(OSM_LAYER_NAMES.railways, railways),
      ]);
      await refresh();
    } catch (err) {
      setOsmFetchError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setFetchingOsm(false);
    }
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>, folderId: string | null) {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploadingKey(folderId ?? 'root');
    try {
      for (const file of Array.from(files)) {
        await uploadProjectDocument({ projectId, file, uploadedBy: user.id, folderId, section });
      }
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

  async function handleRenameFolder(folderId: string, newName: string) {
    await renameDocumentFolder(folderId, newName);
    await refresh();
  }

  async function handleRenameDocument(docId: string, newName: string) {
    await renameProjectDocument(docId, newName);
    await refresh();
  }

  async function handleCreateFolder(name: string, parentFolderId: string | null) {
    if (!name.trim() || !user) return;
    await createDocumentFolder(projectId, name, user.id, section, parentFolderId);
    await refresh();
  }

  async function handleCreateRootFolder(e: FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await handleCreateFolder(newFolderName, null);
      setNewFolderName('');
      setAddingFolder(false);
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
  const rootFolders = folders.filter((f) => f.parent_folder_id === null);

  return (
    <>
      {editable && osmFetchContext && (
        <div className="osm-fetch-row">
          <button type="button" className="doc-folder-add-btn" onClick={handleFetchOsmLayers} disabled={fetchingOsm}>
            {fetchingOsm ? 'Fetching from OpenStreetMap…' : '🌐 Fetch existing infrastructure (OSM)'}
          </button>
          {osmFetchError && <p className="osm-fetch-error">{osmFetchError}</p>}
        </div>
      )}

      {folders.length === 0 && rootDocs.length === 0 && <p className="accordion-empty">{emptyLabel}</p>}

      {rootFolders.map((folder) => (
        <div key={folder.id}>
          <FolderNode
            folder={folder}
            depth={0}
            allFolders={folders}
            allDocuments={documents}
            editable={editable}
            uploadingKey={uploadingKey}
            onUpload={handleUpload}
            onDeleteDocument={handleDeleteDocument}
            onCreateSubfolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onRenameFolder={handleRenameFolder}
            onRenameDocument={handleRenameDocument}
            enabledLayerIds={enabledLayerIds}
            onToggleLayer={onToggleLayer}
            layerErrors={layerErrors}
          />
          {folder.divider_after && <div className="doc-folder-divider" />}
        </div>
      ))}

      {rootDocs.length > 0 && (
        <div className="doc-folder-body doc-folder-root">
          {rootDocs.map((doc) => (
            <div key={doc.id} className="doc-row">
              <span className="doc-row-main">
                <LayerToggle doc={doc} enabledLayerIds={enabledLayerIds} onToggleLayer={onToggleLayer} layerErrors={layerErrors} />
                <RenamableText
                  value={doc.slot_name}
                  editable={editable}
                  onRename={(name) => handleRenameDocument(doc.id, name)}
                >
                  <a href={doc.file_url} target="_blank" rel="noreferrer">
                    {doc.slot_name}
                  </a>
                </RenamableText>
              </span>
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
            <input
              type="file"
              multiple
              onChange={(e) => handleUpload(e, null)}
              disabled={uploadingKey === 'root'}
            />
          </label>

          {addingFolder ? (
            <form className="doc-folder-add-form" onSubmit={handleCreateRootFolder}>
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
