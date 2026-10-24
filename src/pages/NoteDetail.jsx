import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Icon from "../components/Icon";
import api from "../services/api";
import { uploadFile } from "../utils/fileUtils";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { markSeen } from "../utils/newContent";

const MAX_SIZE = 80 * 1024 * 1024; // 80 Mo par fichier

const getExt = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

// Categorie visuelle d'un fichier (badge d'extension colore).
const getKind = (name, mime = "") => {
  const ext = getExt(name);
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "word";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "excel";
  if (["ppt", "pptx", "odp"].includes(ext)) return "ppt";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (mime.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  if (["txt", "md", "json", "xml"].includes(ext)) return "text";
  return "other";
};

const formatSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

// Repare les noms de fichiers envoyes avant la correction UTF-8 du backend
// (ex: "ModÃ©lisation" -> "Modélisation"). Sans effet sur les noms normaux.
const fixName = (s = "") => {
  if (!/[ÃÂ]/.test(s)) return s;
  if ([...s].some((c) => c.charCodeAt(0) > 255)) return s;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  } catch {
    return s;
  }
};

// Reconstruit l'URL d'un fichier a partir de l'adresse du backend actuel.
// Corrige les anciens liens enregistres en "http://localhost:5000/uploads/..."
// (fichiers envoyes depuis un poste de dev) ou en "http://" derriere un proxy.
const resolveFileUrl = (url = "") => {
  try {
    const u = new URL(url);
    if (u.pathname.startsWith("/uploads/")) {
      // On ne garde que l'ORIGINE du backend (sans le suffixe "/api") :
      // les fichiers sont servis sur /uploads/..., pas sur /api/uploads/...
      const origin = new URL(api.defaults.baseURL || "/", window.location.origin).origin;
      return `${origin}${u.pathname}`;
    }
  } catch {
    /* URL relative ou invalide : on la laisse telle quelle */
  }
  return url;
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const emptyEntry = { title: "", text: "" };

const NoteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "viewonly" || (user?.role === "user" && !!user?.sponsor);

  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Pages (notes) du meme cours, affichees sous forme d'onglets
  const [allNotes, setAllNotes] = useState([]);
  const [creatingPage, setCreatingPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");

  // Edition du titre / contenu principal
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

  // Il n'existe pas de route GET /notes/:id : on charge la liste (deja
  // filtree selon le role/sponsor par le backend) et on retrouve la note.
  useEffect(() => {
    // Changement de page (onglet) : on repart d'un etat propre.
    setNotFound(false);
    setEditing(false);
    setEditingEntryId(null);
    setNewEntry(emptyEntry);
    setErrors([]);
    setCreatingPage(false);
    api
      .get("/notes")
      .then(({ data }) => {
        setAllNotes(data);
        const found = data.find((n) => n._id === id);
        if (found) setNote(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async (payload) => {
    const { data } = await api.put(`/notes/${id}`, payload);
    // L'API renvoie le cours sous forme d'id : on garde l'objet peuple.
    setNote((prev) => ({ ...prev, ...data, course: prev.course }));
    setAllNotes((prev) => prev.map((n) => (n._id === id ? { ...n, ...data, course: n.course } : n)));
    return data;
  };

  // Id du cours d'une note (peuple ou non).
  const courseIdOf = (n) => n?.course?._id || n?.course;

  // Cree une nouvelle page dans le meme cours et l'ouvre.
  const createPage = async (e) => {
    e.preventDefault();
    const title = newPageTitle.trim();
    if (!title) return;
    try {
      const { data } = await api.post("/notes", { title, course: courseIdOf(note) });
      setNewPageTitle("");
      setCreatingPage(false);
      showToast("Page creee", { type: "success" });
      navigate(`/notes/${data._id}`);
    } catch {
      showToast("Impossible de creer la page", { type: "error" });
    }
  };

  // Une note ouverte (ou modifiee ici) n'est plus "nouvelle".
  useEffect(() => { if (note) markSeen(note); }, [note]);

  /* ---------------- Fichiers ---------------- */

  // Liste affichee = nouveaux fichiers + ancien fichier unique (s'il existe).
  const getAllFiles = () => {
    if (!note) return [];
    const list = [...(note.files || [])];
    if (note.fileUrl && !list.some((f) => f.fileUrl === note.fileUrl)) {
      list.unshift({ fileName: note.fileName || "Document", fileType: note.fileType, fileUrl: note.fileUrl, size: 0, legacy: true });
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
        uploaded.push({ fileUrl, fileName, fileType, size: size || file.size, sharedWithViewers: !!note.sharedWithViewers });
      } catch (err) {
        newErrors.push(`${file.name} : ${err.response?.data?.message || "echec de l'envoi."}`);
      } finally {
        setUploadingCount((c) => Math.max(0, c - 1));
      }
    }

    if (uploaded.length > 0) {
      try {
        const expected = (note.files || []).length + uploaded.length;
        const saved = await save({ files: [...(note.files || []), ...uploaded] });
        // Si le serveur renvoie moins de fichiers que prevu, son modele Note
        // n'a pas le champ "files" : le backend n'est pas a jour.
        if (!Array.isArray(saved.files) || saved.files.length < expected) {
          newErrors.push(
            "Le serveur a recu le fichier mais ne l'a pas enregistre : le backend n'est pas a jour (models/Note.js). Redeployez le backend."
          );
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
      else await save({ files: (note.files || []).filter((f) => f.fileUrl !== file.fileUrl) });
      showToast("Fichier retire", { type: "info" });
    } catch {
      showToast("Impossible de retirer le fichier", { type: "error" });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!isReadOnly) handleFiles(e.dataTransfer.files);
  };

  /* ---------------- Titre / contenu principal ---------------- */

  const startEdit = () => { setDraft({ title: note.title, content: note.content || "" }); setEditing(true); };

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
      await save({ entries: [{ title: newEntry.title.trim(), text: newEntry.text, sharedWithViewers: !!note.sharedWithViewers }, ...(note.entries || [])] });
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
        entries: (note.entries || []).map((en) =>
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
      await save({ entries: (note.entries || []).filter((en) => en._id !== entry._id) });
      showToast("Note supprimee", { type: "info" });
    } catch {
      showToast("Impossible de supprimer la note", { type: "error" });
    }
  };

  /* ---------------- Partage (page, fichiers, notes) ---------------- */

  // Partage de la page entiere : sans lui, les lecteurs ne voient rien.
  const toggleNoteShare = async () => {
    try {
      await save({ sharedWithViewers: !note.sharedWithViewers });
      showToast(note.sharedWithViewers ? "Page non partagee" : "Page partagee avec les lecteurs", { type: "info" });
    } catch {
      showToast("Impossible de modifier le partage", { type: "error" });
    }
  };

  // Partage d'un fichier precis (visible seulement si la page est partagee).
  const toggleFileShare = async (file) => {
    try {
      if (file.legacy) {
        // Ancien fichier unique : on le migre dans la liste "files" pour
        // pouvoir regler son partage individuellement (il etait partage).
        await save({
          fileUrl: "", fileName: "", fileType: "",
          files: [...(note.files || []), { fileUrl: file.fileUrl, fileName: file.fileName, fileType: file.fileType || "", size: 0, sharedWithViewers: false }],
        });
      } else {
        await save({
          files: (note.files || []).map((f) => (f.fileUrl === file.fileUrl ? { ...f, sharedWithViewers: !f.sharedWithViewers } : f)),
        });
      }
      showToast("Partage du fichier modifie", { type: "info" });
    } catch {
      showToast("Impossible de modifier le partage", { type: "error" });
    }
  };

  // Partage d'une note texte precise.
  const toggleEntryShare = async (entry) => {
    try {
      await save({
        entries: (note.entries || []).map((en) => (en._id === entry._id ? { ...en, sharedWithViewers: !en.sharedWithViewers } : en)),
      });
      showToast("Partage de la note modifie", { type: "info" });
    } catch {
      showToast("Impossible de modifier le partage", { type: "error" });
    }
  };

  /* ---------------- Rendu ---------------- */

  if (loading) {
    return (
      <Layout title="Page de note">
        <PageWrapper><p className="text-muted">Chargement...</p></PageWrapper>
      </Layout>
    );
  }

  if (notFound || !note) {
    return (
      <Layout title="Page de note">
        <PageWrapper>
          <div className="panel-card text-center py-5">
            <h5 className="fw-bold">Page introuvable</h5>
            <p className="text-muted">Elle a ete supprimee ou n'est pas partagee avec vous.</p>
            <button className="btn btn-primary" onClick={() => navigate("/notes")}>
              <Icon name="arrow-left" className="me-1" />Retour aux notes
            </button>
          </div>
        </PageWrapper>
      </Layout>
    );
  }

  const files = getAllFiles();
  const entries = note.entries || [];
  const siblings = allNotes
    .filter((n) => courseIdOf(n) === courseIdOf(note))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return (
    <Layout title="Page de note">
      <PageWrapper>
        {/* ----- Onglets : toutes les pages de ce cours ----- */}
        <div className="page-tabs-bar">
          <span className="page-tabs-course" title={note.course?.title}>
            {note.course?.title || "Cours"}
          </span>
          <div className="page-tabs">
            {siblings.map((p) => (
              <button
                key={p._id}
                className={`page-tab ${p._id === id ? "page-tab-active" : ""}`}
                onClick={() => p._id !== id && navigate(`/notes/${p._id}`)}
                title={p.title}
              >
                {p.title}
              </button>
            ))}
            {!isReadOnly && !creatingPage && (
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
              placeholder="Titre de la nouvelle page (ex: TP 3, Chapitre 2...)"
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" disabled={!newPageTitle.trim()}>Creer</button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setCreatingPage(false); setNewPageTitle(""); }}>Annuler</button>
          </form>
        )}

        <div className="note-detail-header">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => note.course?._id ? navigate(`/courses/${note.course._id}`) : navigate("/notes")}>
            <Icon name="arrow-left" className="me-1" />Retour au cours
          </button>
          {!isReadOnly && (
            <div className="d-flex gap-2">
              <button
                className={`btn btn-sm ${note.sharedWithViewers ? "btn-outline-success" : "btn-outline-secondary"}`}
                onClick={toggleNoteShare}
                title="Les lecteurs ne voient cette page que si elle est partagee"
              >
                <Icon name={note.sharedWithViewers ? "eye" : "eye-slash"} className="me-1" />
                {note.sharedWithViewers ? "Page partagee" : "Page non partagee"}
              </button>
              {!editing && (
                <button className="btn btn-primary btn-sm btn-animated" onClick={startEdit}>
                  <Icon name="pencil" className="me-1" />Modifier la page
                </button>
              )}
            </div>
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
                  <h2 className="fw-bold mb-2 note-detail-title">{note.title}</h2>
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                    {note.course && <span className="badge bg-light text-dark">{note.course.title}</span>}
                    {note.sharedWithViewers && (
                      <span className="badge badge-viewonly"><Icon name="eye" className="me-1" size={13} />Partagee</span>
                    )}
                    <small className="text-muted">Creee le {formatDate(note.createdAt)}</small>
                  </div>
                  {note.content && <p className="note-view-content note-detail-content mb-0">{note.content}</p>}
                </>
              )}
            </div>

            {/* ----- Sous-notes ----- */}
            <div className="panel-card mt-4">
              <h5 className="fw-bold mb-3">Notes ({entries.length})</h5>

              {!isReadOnly && (
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
              )}

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
                          {!isReadOnly && (
                            <div className="d-flex gap-1 flex-shrink-0">
                              <button
                                className="btn-icon"
                                onClick={() => toggleEntryShare(entry)}
                                aria-label="Partager cette note avec les lecteurs"
                                title={entry.sharedWithViewers ? "Partagee avec les lecteurs" : "Non partagee"}
                              >
                                <Icon name={entry.sharedWithViewers ? "eye" : "eye-slash"} className={entry.sharedWithViewers ? "text-success" : "text-muted"} size={15} />
                              </button>
                              <button className="btn-icon" onClick={() => startEditEntry(entry)} aria-label="Modifier la note" title="Modifier"><Icon name="pencil" /></button>
                              <button className="btn-icon text-danger" onClick={() => removeEntry(entry)} aria-label="Supprimer la note" title="Supprimer"><Icon name="trash" /></button>
                            </div>
                          )}
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

              {!isReadOnly && (
                <>
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
                </>
              )}

              <div className="file-list mt-3">
                {files.length === 0 && <p className="text-muted small mb-0">Aucun fichier joint.</p>}
                {files.map((file) => {
                  const kind = getKind(file.fileName, file.fileType);
                  const ext = getExt(file.fileName).toUpperCase() || "FILE";
                  return (
                    <div className="file-item" key={file.fileUrl}>
                      {kind === "image" ? (
                        <img className="file-thumb" src={resolveFileUrl(file.fileUrl)} alt="" loading="lazy" />
                      ) : (
                        <span className={`file-ext-badge file-kind-${kind}`}>{ext.slice(0, 4)}</span>
                      )}
                      <div className="file-item-info">
                        <a href={resolveFileUrl(file.fileUrl)} target="_blank" rel="noopener noreferrer" className="file-item-name" title={fixName(file.fileName)}>
                          {fixName(file.fileName)}
                        </a>
                        {file.size > 0 && <small className="text-muted">{formatSize(file.size)}</small>}
                      </div>
                      <a className="btn-icon" href={resolveFileUrl(file.fileUrl)} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir le fichier" title="Ouvrir">
                        <Icon name="box-arrow-up-right" />
                      </a>
                      {!isReadOnly && (
                        <button
                          className="btn-icon"
                          onClick={() => toggleFileShare(file)}
                          aria-label="Partager ce fichier avec les lecteurs"
                          title={file.legacy || file.sharedWithViewers ? "Partage avec les lecteurs" : "Non partage"}
                        >
                          <Icon name={file.legacy || file.sharedWithViewers ? "eye" : "eye-slash"} className={file.legacy || file.sharedWithViewers ? "text-success" : "text-muted"} size={15} />
                        </button>
                      )}
                      {!isReadOnly && (
                        <button className="btn-icon text-danger" onClick={() => removeFile(file)} aria-label="Retirer le fichier" title="Retirer">
                          <Icon name="trash" />
                        </button>
                      )}
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

export default NoteDetail;