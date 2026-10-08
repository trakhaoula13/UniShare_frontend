import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import useResource from "../hooks/useResource";
import useUndoDelete from "../hooks/useUndoDelete";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const emptyForm = { title: "", content: "", course: "" };
const ITEMS_PER_PAGE = 9;

// Nombre total de fichiers d'une note (nouveau format + ancien PDF unique).
const countFiles = (note) => {
  const list = note.files || [];
  const legacy = note.fileUrl && !list.some((f) => f.fileUrl === note.fileUrl) ? 1 : 0;
  return list.length + legacy;
};

const Notes = () => {
  const { items: notes, setItems: setNotes, create, update } = useResource("/notes");
  const { showToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isReadOnly = user?.role === "viewonly" || (user?.role === "user" && !!user?.sponsor);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get("/courses").then(({ data }) => setCourses(data));
  }, []);

  const deleteWithUndo = useUndoDelete({
    setItems: setNotes,
    removeFn: (id) => api.delete(`/notes/${id}`),
    getLabel: (note) => note.title,
  });

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); };
  const openEdit = (note) => {
    setForm({ title: note.title, content: note.content || "", course: note.course?._id || "" });
    setEditingId(note._id);
    setShowModal(true);
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

  const totalPages = Math.max(1, Math.ceil(notes.length / ITEMS_PER_PAGE));
  const paginatedNotes = notes.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

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
            {paginatedNotes.map((note, i) => {
              const fileCount = countFiles(note);
              return (
                <motion.div
                  key={note._id}
                  className="col-md-6 col-xl-4"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="note-card note-card-clickable" onClick={() => navigate(`/notes/${note._id}`)}>
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
                    {note.content && <p className="text-muted small note-content">{note.content}</p>}
                    {fileCount > 0 && (
                      <div className="pdf-chip">
                        <Icon name="file-earmark-pdf-fill" />
                        <span className="text-truncate">{fileCount} fichier{fileCount > 1 ? "s" : ""} joint{fileCount > 1 ? "s" : ""}</span>
                        <Icon name="arrow-up-right-circle" className="ms-auto" />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {notes.length === 0 && <p className="text-muted">Aucune note pour le moment.</p>}
        </div>

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

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
              <textarea className="form-control" rows="4" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}></textarea>
            </div>
            <p className="text-muted small">
              Pour ajouter des fichiers (PDF, Word, images...), ouvrez la note apres l'avoir creee.
            </p>
            <button className="btn btn-primary w-100 btn-animated">{editingId ? "Enregistrer" : "Creer la note"}</button>
          </form>
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Notes;