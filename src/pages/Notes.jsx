import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import useResource from "../hooks/useResource";
import useUndoDelete from "../hooks/useUndoDelete";
import api from "../services/api";
import { uploadFile } from "../utils/fileUtils";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const emptyForm = { title: "", content: "", course: "", fileName: "", fileType: "", fileUrl: "" };

const Notes = () => {
  const { items: notes, setItems: setNotes, create, update } = useResource("/notes");
  const { showToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "viewonly" || (user?.role === "user" && !!user?.sponsor);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [viewingNote, setViewingNote] = useState(null);

  useEffect(() => {
    api.get("/courses").then(({ data }) => setCourses(data));
  }, []);

  const deleteWithUndo = useUndoDelete({
    setItems: setNotes,
    removeFn: (id) => api.delete(`/notes/${id}`),
    getLabel: (note) => note.title,
  });

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setFileError(""); setShowModal(true); };
  const openEdit = (note) => { setForm({ ...note, course: note.course?._id || "" }); setEditingId(note._id); setFileError(""); setShowModal(true); };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setFileError("Seuls les fichiers PDF sont acceptes."); return; }
    if (file.size > 8 * 1024 * 1024) { setFileError("Le fichier ne doit pas depasser 8 Mo."); return; }
    setFileError("");
    setUploading(true);
    try {
      const { fileUrl, fileName, fileType } = await uploadFile(file);
      setForm((f) => ({ ...f, fileUrl, fileName, fileType }));
    } catch {
      setFileError("Echec de l'envoi du fichier.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) await update(editingId, form);
    else await create(form);
    setShowModal(false);
    showToast(editingId ? "Note mise a jour" : "Note creee", { type: "success" });
  };

  const toggleShare = (e, note) => {
    e.stopPropagation();
    update(note._id, { sharedWithViewers: !note.sharedWithViewers });
    showToast(note.sharedWithViewers ? "Partage retire" : "Note partagee", { type: "info" });
  };

  return (
    <Layout title="Mes notes">
      <PageWrapper>
        {!isReadOnly && (
          <div className="d-flex justify-content-end mb-3">
            <button className="btn btn-primary btn-animated" onClick={openCreate} disabled={courses.length === 0}>
              <Icon name="plus-lg" className="me-1" />Nouvelle note
            </button>
          </div>
        )}
        {courses.length === 0 && !isReadOnly && (
          <div className="alert alert-warning py-2">
            Vous devez d'abord creer un cours avant de pouvoir ajouter une note.
          </div>
        )}

        <div className="row g-3">
          <AnimatePresence>
            {notes.map((note, i) => (
              <motion.div
                key={note._id}
                className="col-md-6 col-xl-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="note-card note-card-clickable" onClick={() => setViewingNote(note)}>
                  <div className="d-flex justify-content-between align-items-start">
                    <h6 className="fw-bold note-title-clamp">{note.title}</h6>
                    {!isReadOnly && (
                      <div className="d-flex align-items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button className="btn-icon" onClick={(e) => toggleShare(e, note)} aria-label="Basculer le partage" title={note.sharedWithViewers ? "Partage" : "Non partage"}>
                          <Icon name={note.sharedWithViewers ? "eye" : "eye-slash"} className={note.sharedWithViewers ? "text-success" : "text-muted"} size={15} />
                        </button>
                        <div className="dropdown">
                          <button className="btn-icon" data-bs-toggle="dropdown" aria-label="Options de la note"><Icon name="three-dots-vertical" /></button>
                          <ul className="dropdown-menu dropdown-menu-end">
                            <li><button className="dropdown-item" onClick={() => openEdit(note)}><Icon name="pencil" className="me-2" />Modifier</button></li>
                            <li><button className="dropdown-item text-danger" onClick={() => deleteWithUndo(note)}><Icon name="trash" className="me-2" />Supprimer</button></li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                  {note.course && <span className="badge bg-light text-dark mb-2">{note.course.title}</span>}
                  {note.fileUrl ? (
                    <a className="pdf-chip" href={note.fileUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <Icon name="file-earmark-pdf-fill" />
                      <span className="text-truncate">{note.fileName}</span>
                      <Icon name="box-arrow-up-right" className="ms-auto" />
                    </a>
                  ) : (
                    <p className="text-muted small note-content">{note.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {notes.length === 0 && <p className="text-muted">Aucune note pour le moment.</p>}
        </div>

        <Modal show={showModal} onClose={() => setShowModal(false)} title={editingId ? "Modifier la note" : "Nouvelle note"}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Titre</label>
              <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Cours associe *</label>
              <select className="form-select" required value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                <option value="" disabled>Choisir un cours...</option>
                {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Contenu (note texte)</label>
              <textarea className="form-control" rows="4" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Laisser vide si vous joignez un PDF"></textarea>
            </div>
            <div className="mb-3">
              <label className="form-label">Document PDF (optionnel)</label>
              <input type="file" accept="application/pdf" className="form-control" onChange={handleFileChange} disabled={uploading} />
              {uploading && <small className="text-muted">Envoi en cours...</small>}
              {fileError && <small className="text-danger d-block">{fileError}</small>}
              {form.fileName && !fileError && (
                <div className="pdf-chip mt-2">
                  <Icon name="file-earmark-pdf-fill" />
                  <span className="text-truncate">{form.fileName}</span>
                  <button type="button" className="btn-icon ms-auto" onClick={() => setForm({ ...form, fileName: "", fileType: "", fileUrl: "" })} aria-label="Retirer le fichier">
                    <Icon name="x-lg" />
                  </button>
                </div>
              )}
            </div>
            <button className="btn btn-primary w-100 btn-animated" disabled={uploading}>{editingId ? "Enregistrer" : "Creer la note"}</button>
          </form>
        </Modal>

        <Modal show={!!viewingNote} onClose={() => setViewingNote(null)} title="Details de la note">
          {viewingNote && (
            <div>
              <h5 className="fw-bold mb-2">{viewingNote.title}</h5>
              {viewingNote.course && <span className="badge bg-light text-dark mb-3">{viewingNote.course.title}</span>}
              {viewingNote.fileUrl && (
                <a className="pdf-chip mt-2 mb-2" href={viewingNote.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Icon name="file-earmark-pdf-fill" />
                  <span className="text-truncate">{viewingNote.fileName}</span>
                  <Icon name="box-arrow-up-right" className="ms-auto" />
                </a>
              )}
              <p className="note-view-content mt-2">{viewingNote.content || "Aucun contenu."}</p>
              <div className="d-flex gap-2 mt-4">
                {!isReadOnly && (
                  <button className="btn btn-outline-primary flex-grow-1" onClick={() => { setViewingNote(null); openEdit(viewingNote); }}>
                    <Icon name="pencil" className="me-1" />Modifier
                  </button>
                )}
                <button className="btn btn-outline-secondary flex-grow-1" onClick={() => setViewingNote(null)}>Fermer</button>
              </div>
            </div>
          )}
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Notes;