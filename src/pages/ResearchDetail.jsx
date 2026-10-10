import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Icon from "../components/Icon";
import api from "../services/api";
import { uploadFile } from "../utils/fileUtils";
import { getExt, getKind, formatSize, formatDate, fixName, resolveFileUrl } from "../utils/fileHelpers";
import { useToast } from "../context/ToastContext";

const MAX_SIZE = 80 * 1024 * 1024; // 80 Mo par fichier
const emptyEntry = { title: "", text: "" };
const categoryLabel = (c) => (c === "thesis" ? "Thèse" : "Projet tutoré / Article");

const ResearchDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [item, setItem] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Onglets : autres elements de la meme categorie
  const [creatingPage, setCreatingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");

  // Edition du titre / description
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", content: "" });

  // Fichiers
  const [uploadingCount, setUploadingCount] = useState(0);
  const [errors, setErrors] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  // Sous-notes texte
  const [newEntry, setNewEntry] = useState(emptyEntry);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [entryDraft, setEntryDraft] = useState(emptyEntry);

  // Il n'existe pas de route GET /research/:id : on charge la liste
  // (limitee a l'utilisateur par le backend) et on retrouve l'element.
  useEffect(() => {
    setNotFound(false);
    setEditing(false);
    setEditingEntryId(null);
    setNewEntry(emptyEntry);
    setErrors([]);
    setCreatingPage(false);
    api
      .get("/research")
      .then(({ data }) => {
        setAllItems(data);
        const found = data.find((r) => r._id === id);
        if (found) setItem(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async (payload) => {
    const { data } = await api.put(`/research/${id}`, payload);
    // L'API renvoie le cours sous forme d'id : on garde l'objet peuple.
    setItem((prev) => ({ ...prev, ...data, course: prev.course }));
    setAllItems((prev) => prev.map((r) => (r._id === id ? { ...r, ...data, course: r.course } : r)));
    return data;
  };

  const goBack = () => navigate("/research", { state: { tab: item?.category || "article" } });

  /* ---------------- Onglets ---------------- */

  const createPage = async (e) => {
    e.preventDefault();
    const title = newPageTitle.trim();
    if (!title) return;
    try {
      const { data } = await api.post("/research", { title, category: item.category });
      setNewPageTitle("");
      setCreatingPage(false);
      showToast("Page creee", { type: "success" });
      navigate(`/research/${data._id}`);
    } catch {
      showToast("Impossible de creer la page", { type: "error" });
    }
  };

  /* ---------------- Fichiers ---------------- */

  // Liste affichee = nouveaux fichiers + ancien fichier unique (s'il existe).
  const getAllFiles = () => {
    if (!item) return [];
    const list = [...(item.files || [])];
    if (item.fileUrl && !list.some((f) => f.fileUrl === item.fileUrl)) {
      list.unshift({ fileName: item.fileName || "Document", fileType: item.fileType, fileUrl: item.fileUrl, size: 0, legacy: true });
    }
    return list;
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const newErrors = [];
    const uploaded = [];
    setUploadingCount(files.length);

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        newErrors.push(`${file.name} : depasse 80 Mo.`);
        setUploadingCount((c) => Math.max(0, c - 1));
        continue;
      }
      try {
        const { fileUrl, fileName, fileType, size } = await uploadFile(file);
        uploaded.push({ fileUrl, fileName, fileType, size: size || file.size });
      } catch (err) {
        newErrors.push(`${file.name} : ${err.response?.data?.message || "echec de l'envoi."}`);
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1));
      }
    }

    if (uploaded.length > 0) {
      try {
        const expected = (item.files || []).length + uploaded.length;
        const saved = await save({ files: [...(item.files || []), ...uploaded] });
        // Si le serveur renvoie moins de fichiers que prevu, son modele
        // Research n'a pas le champ "files" : le backend n'est pas a jour.
        if (!Array.isArray(saved.files) || saved.files.length < expected) {
          newErrors.push("Le serveur a recu le fichier mais ne l'a pas enregistre : le backend n'est pas a jour (models/Research.js). Redeployez le backend.");
        } else {
          showToast(`${uploaded.length} fichier${uploaded.length > 1 ? "s" : ""} ajoute${uploaded.length > 1 ? "s" : ""}`, { type: "success" });
        }
      } catch (err) {
        newErrors.push(`Enregistrement impossible : ${err.response?.data?.message || err.message || "erreur serveur"}`);
      }
    }
    setErrors(newErrors);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = async (file) => {
    if (!window.confirm(`Retirer "${fixName(file.fileName)}" de cette page ?`)) return;
    try {
      if (file.legacy) await save({ fileUrl: "", fileName: "", fileType: "" });
      else await save({ files: (item.files || []).filter((f) => f.fileUrl !== file.fileUrl) });
      showToast("Fichier retire", { type: "info" });
    } catch {
      showToast("Impossible de retirer le fichier", { type: "error" });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  /* ---------------- Titre / description ---------------- */

  const startEdit = () => { setDraft({ title: item.title, content: item.content || "" }); setEditing(true); };

  const saveEdit = async () => {
    if (!draft.title.trim()) return;
    try {
      await save({ title: draft.title.trim(), content: draft.content });
      setEditing(false);
      showToast("Page mise a jour", { type: "success" });
    } catch {
      showToast("Impossible d'enregistrer la page", { type: "error" });
    }
  };

  /* ---------------- Sous-notes texte ---------------- */

  const addEntry = async (e) => {
    e.preventDefault();
    if (!newEntry.text.trim()) return;
    try {
      await save({ entries: [{ title: newEntry.title.trim(), text: newEntry.text }, ...(item.entries || [])] });
      setNewEntry(emptyEntry);
      showToast("Note ajoutee", { type: "success" });
    } catch {
      showToast("Impossible d'ajouter la note", { type: "error" });
    }
  };

  const startEditEntry = (entry) => {
    setEditingEntryId(entry._id);
    setEntryDraft({ title: entry.title || "", text: entry.text });
  };

  const saveEntry = async (entryId) => {
    if (!entryDraft.text.trim()) return;
    try {
      await save({
        entries: (item.entries || []).map((en) =>
          en._id === entryId ? { ...en, title: entryDraft.title.trim(), text: entryDraft.text } : en
        ),
      });
      setEditingEntryId(null);
      showToast("Note mise a jour", { type: "success" });
    } catch {
      showToast("Impossible d'enregistrer la note", { type: "error" });
    }
  };

  const removeEntry = async (entry) => {
    if (!window.confirm("Supprimer cette note ?")) return;
    try {
      await save({ entries: (item.entries || []).filter((en) => en._id !== entry._id) });
      showToast("Note supprimee", { type: "info" });
    } catch {
      showToast("Impossible de supprimer la note", { type: "error" });
    }
  };

  /* ---------------- Rendu ---------------- */

  if (loading) {
    return (
      <Layout title="Recherche">
        <PageWrapper><p className="text-muted">Chargement...</p></PageWrapper>
      </Layout>
    );
  }

  if (notFound || !item) {
    return (
      <Layout title="Recherche">
        <PageWrapper>
          <div className="panel-card text-center py-5">
            <h5 className="fw-bold">Page introuvable</h5>
            <p className="text-muted">Elle a ete supprimee.</p>
            <button className="btn btn-primary" onClick={() => navigate("/research")}>
              <Icon name="arrow-left" className="me-1" />Retour a la recherche
            </button>
          </div>
        </PageWrapper>
      </Layout>
    );
  }

  const files = getAllFiles();
  const entries = item.entries || [];
  const siblings = allItems
    .filter((r) => r.category === item.category)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return (
    <Layout title="Recherche">
      <PageWrapper>
        {/* ----- Onglets : tous les elements de cette categorie ----- */}
        <div className="page-tabs-bar">
          <span className="page-tabs-course" title={categoryLabel(item.category)}>
            {categoryLabel(item.category)}
          </span>
          <div className="page-tabs">
            {siblings.map((p) => (
              <button
                key={p._id}
                className={`page-tab ${p._id === id ? "page-tab-active" : ""}`}
                onClick={() => p._id !== id && navigate(`/research/${p._id}`)}
                title={p.title}
              >
                {p.title}
              </button>
            ))}
            {!creatingPage && (
              <button className="page-tab page-tab-add" onClick={() => setCreatingPage(true)} aria-label="Nouvelle page" title="Nouvelle page">
                <Icon name="plus-lg" />
              </button>
            )}
          </div>
        </div>

        {creatingPage && (
          <form className="page-tab-form" onSubmit={createPage}>
            <input
              className="form-control form-control-sm"
              placeholder="Titre de la nouvelle page"
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" disabled={!newPageTitle.trim()}>Creer</button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setCreatingPage(false); setNewPageTitle(""); }}>Annuler</button>
          </form>
        )}

        <div className="note-detail-header">
          <button className="btn btn-outline-secondary btn-sm" onClick={goBack}>
            <Icon name="arrow-left" className="me-1" />Retour a la recherche
          </button>
          {!editing && (
            <button className="btn btn-primary btn-sm btn-animated" onClick={startEdit}>
              <Icon name="pencil" className="me-1" />Modifier la page
            </button>
          )}
        </div>

        <div className="row g-4">
          {/* ----- Colonne gauche : page + sous-notes ----- */}
          <div className="col-lg-7 col-xl-8">
            <div className="panel-card note-detail-main">
              {editing ? (
                <>
                  <label className="form-label">Titre</label>
                  <input className="form-control form-control-lg mb-3" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  <label className="form-label">Description de la page</label>
                  <textarea className="form-control" rows="6" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
                  <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-primary btn-animated" onClick={saveEdit}>Enregistrer</button>
                    <button className="btn btn-outline-secondary" onClick={() => setEditing(false)}>Annuler</button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="fw-bold mb-2 note-detail-title">{item.title}</h2>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                    <span className="badge bg-light text-dark">{categoryLabel(item.category)}</span>
                    {item.course && <span className="badge bg-light text-dark">{item.course.title}</span>}
                    <small className="text-muted">Creee le {formatDate(item.createdAt)}</small>
                  </div>
                  {item.content && <p className="note-view-content note-detail-content mb-0">{item.content}</p>}
                </>
              )}
            </div>

            {/* ----- Sous-notes ----- */}
            <div className="panel-card mt-4">
              <h5 className="fw-bold mb-3">Notes ({entries.length})</h5>

              <form className="entry-form mb-4" onSubmit={addEntry}>
                <input
                  className="form-control mb-2"
                  placeholder="Titre (optionnel)"
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                />
                <textarea
                  className="form-control mb-2"
                  rows="4"
                  placeholder="Ecrire une nouvelle note..."
                  value={newEntry.text}
                  onChange={(e) => setNewEntry({ ...newEntry, text: e.target.value })}
                />
                <button className="btn btn-primary btn-sm btn-animated" disabled={!newEntry.text.trim()}>
                  <Icon name="plus-lg" className="me-1" />Ajouter la note
                </button>
              </form>

              {entries.length === 0 && <p className="text-muted small mb-0">Aucune note dans cette page.</p>}

              <div className="entry-list">
                {entries.map((entry) => (
                  <div className="entry-card" key={entry._id}>
                    {editingEntryId === entry._id ? (
                      <>
                        <input className="form-control mb-2" placeholder="Titre (optionnel)" value={entryDraft.title} onChange={(e) => setEntryDraft({ ...entryDraft, title: e.target.value })} />
                        <textarea className="form-control mb-2" rows="5" value={entryDraft.text} onChange={(e) => setEntryDraft({ ...entryDraft, text: e.target.value })} />
                        <div className="d-flex gap-2">
                          <button className="btn btn-primary btn-sm" onClick={() => saveEntry(entry._id)}>Enregistrer</button>
                          <button className="btn btn-outline-secondary btn-sm" onClick={() => setEditingEntryId(null)}>Annuler</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="min-w-0">
                            {entry.title && <h6 className="fw-bold mb-1">{entry.title}</h6>}
                            <small className="text-muted">{formatDate(entry.createdAt)}</small>
                          </div>
                          <div className="d-flex gap-1 flex-shrink-0">
                            <button className="btn-icon" onClick={() => startEditEntry(entry)} aria-label="Modifier la note" title="Modifier"><Icon name="pencil" /></button>
                            <button className="btn-icon text-danger" onClick={() => removeEntry(entry)} aria-label="Supprimer la note" title="Supprimer"><Icon name="trash" /></button>
                          </div>
                        </div>
                        <p className="note-view-content mt-2 mb-0">{entry.text}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ----- Colonne droite : fichiers ----- */}
          <div className="col-lg-5 col-xl-4">
            <div className="panel-card note-files-panel">
              <h5 className="fw-bold mb-3">Fichiers ({files.length})</h5>

              <div
                className={`file-dropzone ${dragOver ? "file-dropzone-active" : ""}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") inputRef.current?.click(); }}
              >
                <Icon name="plus-lg" size={22} />
                <strong>Ajouter des fichiers</strong>
                <small className="text-muted">Glissez-deposez ou cliquez · PDF, Word, Excel, images, ZIP... (80 Mo max par fichier)</small>
              </div>
              <input ref={inputRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
              {uploadingCount > 0 && <small className="text-muted d-block mt-2">Envoi en cours ({uploadingCount} restant{uploadingCount > 1 ? "s" : ""})...</small>}
              {errors.map((msg, i) => <small key={i} className="text-danger d-block mt-1">{msg}</small>)}

              <div className="file-list mt-3">
                {files.length === 0 && <p className="text-muted small mb-0">Aucun fichier joint.</p>}
                {files.map((file) => {
                  const kind = getKind(file.fileName, file.fileType);
                  const ext = getExt(file.fileName).toUpperCase() || "FILE";
                  const url = resolveFileUrl(file.fileUrl);
                  return (
                    <div className="file-item" key={file.fileUrl}>
                      {kind === "image" ? (
                        <img className="file-thumb" src={url} alt="" loading="lazy" />
                      ) : (
                        <span className={`file-ext-badge file-kind-${kind}`}>{ext.slice(0, 4)}</span>
                      )}
                      <div className="file-item-info">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="file-item-name" title={fixName(file.fileName)}>
                          {fixName(file.fileName)}
                        </a>
                        {file.size > 0 && <small className="text-muted">{formatSize(file.size)}</small>}
                      </div>
                      <a className="btn-icon" href={url} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir le fichier" title="Ouvrir">
                        <Icon name="box-arrow-up-right" />
                      </a>
                      <button className="btn-icon text-danger" onClick={() => removeFile(file)} aria-label="Retirer le fichier" title="Retirer">
                        <Icon name="trash" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </PageWrapper>
    </Layout>
  );
};

export default ResearchDetail;