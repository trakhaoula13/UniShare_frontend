import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useAuth } from "../context/AuthContext";
import useUndoDelete from "../hooks/useUndoDelete";
import Icon from "../components/Icon";

const emptyForm = { title: "", content: "" };

// Nombre total de fichiers d'une note (nouveau format + ancien PDF unique).
const countFiles = (note) => {
  const list = note.files || [];
  const legacy = note.fileUrl && !list.some((f) => f.fileUrl === note.fileUrl) ? 1 : 0;
  return list.length + legacy;
};

const CourseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isReadOnly = user?.role === "viewonly" || (user?.role === "user" && !!user?.sponsor);
  const [course, setCourse] = useState(null);
  const [notes, setNotes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editCourse, setEditCourse] = useState(false);
  const [courseForm, setCourseForm] = useState(null);
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoadError("");
    try {
      const [cRes, nRes] = await Promise.all([
        api.get(`/courses/${id}`),
        api.get("/notes"),
      ]);
      setCourse(cRes.data);
      setCourseForm(cRes.data);
      setProgressValue(cRes.data.progress);
      setNotes(nRes.data.filter((n) => n.course?._id === id || n.course === id));
    } catch (err) {
      setLoadError(err.response?.data?.message || "Impossible de charger ce cours.");
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const deleteNoteWithUndo = useUndoDelete({
    setItems: setNotes,
    removeFn: (noteId) => api.delete(`/notes/${noteId}`),
    getLabel: (note) => note.title,
  });

  const openCreate = () => { setForm({ ...emptyForm }); setEditingId(null); setShowModal(true); };
  const openEdit = (note) => {
    setForm({ title: note.title, content: note.content || "" });
    setEditingId(note._id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      const { data } = await api.put(`/notes/${editingId}`, { ...form, course: id });
      // L'API renvoie le cours sous forme d'id : on garde la note complete.
      setNotes((prev) => prev.map((n) => (n._id === editingId ? { ...n, ...data, course: n.course } : n)));
      setShowModal(false);
      showToast("Note mise a jour", { type: "success" });
    } else {
      const { data } = await api.post("/notes", { ...form, course: id });
      setShowModal(false);
      showToast("Page creee : ajoutez vos fichiers et notes", { type: "success" });
      // On ouvre directement la nouvelle page pour y ajouter fichiers et notes.
      navigate(`/notes/${data._id}`);
    }
  };

  const handleCourseSave = async (e) => {
    e.preventDefault();
    const { data } = await api.put(`/courses/${id}`, courseForm);
    setCourse(data);
    setEditCourse(false);
    showToast("Cours mis a jour", { type: "success" });
  };

  const handleCourseDelete = async () => {
    const ok = await confirm(`Supprimer definitivement le cours "${course.title}" ? Toutes ses notes seront aussi perdues.`);
    if (!ok) return;
    await api.delete(`/courses/${id}`);
    showToast("Cours supprime", { type: "info" });
    navigate("/courses");
  };

  const saveQuickProgress = async () => {
    const { data } = await api.put(`/courses/${id}`, { progress: progressValue });
    setCourse(data);
    setEditingProgress(false);
  };

  if (loadError) {
    return (
      <Layout title="Cours">
        <PageWrapper>
          <div className="panel-card text-center py-5" style={{ maxWidth: 480, margin: "0 auto" }}>
            <Icon name="exclamation-triangle" size={28} className="text-warning mb-2" />
            <p className="mb-3">{loadError}</p>
            <button className="btn btn-outline-secondary" onClick={() => navigate("/courses")}>
              <Icon name="arrow-left" className="me-1" />Retour aux cours
            </button>
          </div>
        </PageWrapper>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout title="Chargement...">
        <div className="d-flex justify-content-center py-5"><div className="spinner-border text-primary" /></div>
      </Layout>
    );
  }

  return (
    <Layout title={course.title}>
      <PageWrapper>
        <button className="btn btn-sm btn-outline-secondary mb-3" onClick={() => navigate("/courses")}>
          <Icon name="arrow-left" className="me-1" />Retour aux cours
        </button>

        <div className="panel-card mb-4" style={{ borderTop: `4px solid ${course.color}` }}>
          {!editCourse ? (
            <>
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                  <span className="course-code mb-2 d-inline-block">{course.code || "COURS"}</span>
                  <h3 className="fw-bold mb-1">{course.title}</h3>
                  <p className="text-muted mb-0">{course.description || "Aucune description"}</p>
                </div>
                <div className="d-flex gap-2">
                  {!isReadOnly && (
                    <>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setEditCourse(true)}>
                        <Icon name="pencil" className="me-1" />Modifier
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={handleCourseDelete}>
                        <Icon name="trash" className="me-1" />Supprimer
                      </button>
                    </>
                  )}
                </div>
              </div>
              {!isReadOnly && (
                <>
                  <div className="progress-track mt-3">
                    <div className="progress-fill" style={{ width: `${course.progress}%` }}></div>
                  </div>
                  {editingProgress ? (
                    <div className="progress-editor mt-1">
                      <input
                        type="range" min="0" max="100" className="form-range"
                        value={progressValue}
                        onChange={(e) => setProgressValue(Number(e.target.value))}
                        aria-label="Ajuster la progression"
                      />
                      <div className="d-flex justify-content-between align-items-center">
                        <small className="fw-bold">{progressValue}%</small>
                        <div className="d-flex gap-1">
                          <button className="btn-icon text-success" onClick={saveQuickProgress} aria-label="Valider"><Icon name="check-lg" /></button>
                          <button className="btn-icon text-danger" onClick={() => { setEditingProgress(false); setProgressValue(course.progress); }} aria-label="Annuler"><Icon name="x-lg" /></button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="d-flex justify-content-between align-items-center mt-1">
                      <small className="text-muted">Progression</small>
                      <div className="d-flex align-items-center gap-2">
                        <small className="fw-bold">{course.progress}%</small>
                        <button className="btn-icon progress-edit-btn" onClick={() => setEditingProgress(true)} title="Modifier la progression" aria-label="Modifier la progression">
                          <Icon name="pencil" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <form onSubmit={handleCourseSave}>
              <div className="mb-3">
                <label className="form-label">Titre</label>
                <input className="form-control" required value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} />
              </div>
              <div className="row">
                <div className="col-6 mb-3">
                  <label className="form-label">Code</label>
                  <input className="form-control" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} />
                </div>
                <div className="col-6 mb-3">
                  <label className="form-label">Couleur</label>
                  <input type="color" className="form-control form-control-color" value={courseForm.color} onChange={(e) => setCourseForm({ ...courseForm, color: e.target.value })} />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows="3" value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}></textarea>
              </div>
              <div className="mb-3">
                <label className="form-label">Progression ({courseForm.progress}%)</label>
                <input type="range" min="0" max="100" className="form-range" value={courseForm.progress} onChange={(e) => setCourseForm({ ...courseForm, progress: Number(e.target.value) })} />
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-primary btn-animated">Enregistrer</button>
                <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditCourse(false); setCourseForm(course); }}>Annuler</button>
              </div>
            </form>
          )}
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="fw-bold mb-0"><Icon name="journal-text" className="me-2" />Notes & documents</h5>
          {!isReadOnly && (
            <button className="btn btn-primary btn-animated" onClick={openCreate}>
              <Icon name="plus-lg" className="me-1" />Nouvelle page
            </button>
          )}
        </div>

        <div className="row g-3">
          <AnimatePresence>
            {notes.map((note, i) => {
              const fileCount = countFiles(note);
              const entryCount = (note.entries || []).length;
              return (
                <motion.div
                  key={note._id}
                  className="col-md-6 col-xl-4"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="note-card h-100 note-card-clickable" onClick={() => navigate(`/notes/${note._id}`)}>
                    <div className="d-flex justify-content-between align-items-start">
                      <h6 className="fw-bold note-title-clamp">{note.title}</h6>
                      {!isReadOnly && (
                        <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                          <button className="btn-icon" data-bs-toggle="dropdown" aria-label="Options de la note"><Icon name="three-dots-vertical" /></button>
                          <ul className="dropdown-menu dropdown-menu-end">
                            <li><button className="dropdown-item" onClick={() => openEdit(note)}><Icon name="pencil" className="me-2" />Modifier</button></li>
                            <li><button className="dropdown-item text-danger" onClick={() => deleteNoteWithUndo(note)}><Icon name="trash" className="me-2" />Supprimer</button></li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {note.content && <p className="text-muted small note-content">{note.content}</p>}

                    {(fileCount > 0 || entryCount > 0) && (
                      <div className="pdf-chip">
                        <Icon name="file-earmark-pdf-fill" />
                        <span className="text-truncate">
                          {fileCount} fichier{fileCount > 1 ? "s" : ""} · {entryCount} note{entryCount > 1 ? "s" : ""}
                        </span>
                        <Icon name="arrow-up-right-circle" className="ms-auto" />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {notes.length === 0 && <p className="text-muted">Aucune page pour ce cours.</p>}
        </div>

        <Modal show={showModal} onClose={() => setShowModal(false)} title={editingId ? "Modifier la page" : "Nouvelle page"}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Titre</label>
              <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Description (optionnel)</label>
              <textarea className="form-control" rows="4" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}></textarea>
            </div>
            {!editingId && (
              <p className="text-muted small">
                Vous pourrez ajouter plusieurs fichiers (PDF, Word, images...) et plusieurs notes dans la page qui s'ouvre apres la creation.
              </p>
            )}
            <button className="btn btn-primary w-100 btn-animated">{editingId ? "Enregistrer" : "Creer la page"}</button>
          </form>
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default CourseDetail;