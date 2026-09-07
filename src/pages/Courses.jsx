import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import useResource from "../hooks/useResource";
import useUndoDelete from "../hooks/useUndoDelete";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const emptyForm = { title: "", code: "", description: "", color: "#6c63ff", progress: 0 };

const Courses = () => {
  const { items: courses, setItems: setCourses, create, update } = useResource("/courses");
  const { showToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "viewonly" || (user?.role === "user" && !!user?.sponsor);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingProgressId, setEditingProgressId] = useState(null);
  const [progressValue, setProgressValue] = useState(0);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const deleteWithUndo = useUndoDelete({
    setItems: setCourses,
    removeFn: (id) => api.delete(`/courses/${id}`),
    getLabel: (course) => course.title,
  });

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); };
  const openEdit = (course) => { setForm(course); setEditingId(course._id); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) await update(editingId, form);
    else await create(form);
    setShowModal(false);
    showToast(editingId ? "Cours mis a jour" : "Cours cree", { type: "success" });
  };

  const openProgressEditor = (course) => {
    setEditingProgressId(course._id);
    setProgressValue(course.progress);
  };

  const saveProgress = async (id) => {
    await update(id, { progress: progressValue });
    setEditingProgressId(null);
  };

  const toggleShare = async (e, course) => {
    e.stopPropagation();
    const updated = await update(course._id, { sharedWithViewers: !course.sharedWithViewers });
    showToast(updated.sharedWithViewers ? "Cours partage avec les lecteurs" : "Partage retire", { type: "info" });
  };

  const filteredCourses = courses.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.title.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q);
  });

  return (
    <Layout title="Mes cours">
      <PageWrapper>
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div className="search-input-wrapper">
            <Icon name="search" className="search-input-icon" />
            <input
              className="form-control"
              placeholder="Rechercher un cours (titre ou code)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Rechercher un cours"
            />
          </div>
          {!isReadOnly && (
            <button className="btn btn-primary btn-animated" onClick={openCreate}>
              <Icon name="plus-lg" className="me-1" />Nouveau cours
            </button>
          )}
        </div>

        <div className="row g-3">
          <AnimatePresence>
            {filteredCourses.map((course, i) => (
              <motion.div
                key={course._id}
                className="col-md-6 col-xl-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
              >
                <div
                  className="course-card course-card-clickable"
                  style={{ "--course-color": course.color }}
                  onClick={() => navigate(`/courses/${course._id}`)}
                >
                  <div className="course-card-top">
                    <span className="course-code">{course.code || "COURS"}</span>
                    {!isReadOnly && (
                      <div className="d-flex align-items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-icon"
                          onClick={(e) => toggleShare(e, course)}
                          title={course.sharedWithViewers ? "Partage avec les lecteurs" : "Non partage"}
                          aria-label="Basculer le partage avec les lecteurs"
                        >
                          <Icon name={course.sharedWithViewers ? "eye" : "eye-slash"} className={course.sharedWithViewers ? "text-success" : "text-muted"} size={15} />
                        </button>
                        <div className="dropdown">
                          <button className="btn btn-sm btn-icon" data-bs-toggle="dropdown" aria-label="Options du cours"><Icon name="three-dots-vertical" /></button>
                          <ul className="dropdown-menu dropdown-menu-end">
                            <li><button className="dropdown-item" onClick={() => openEdit(course)}><Icon name="pencil" className="me-2" />Modifier</button></li>
                            <li><button className="dropdown-item text-danger" onClick={() => deleteWithUndo(course)}><Icon name="trash" className="me-2" />Supprimer</button></li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                  <h5>{course.title}</h5>
                  <p className="text-muted small course-description-clamp">{course.description || "Aucune description"}</p>

                  {!isReadOnly && (
                    editingProgressId === course._id ? (
                      <div className="progress-editor" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="range" min="0" max="100" className="form-range"
                          value={progressValue}
                          onChange={(e) => setProgressValue(Number(e.target.value))}
                          aria-label="Ajuster la progression"
                        />
                        <div className="d-flex justify-content-between align-items-center mt-1">
                          <small className="fw-bold">{progressValue}%</small>
                          <div className="d-flex gap-1">
                            <button className="btn-icon text-success" onClick={() => saveProgress(course._id)} aria-label="Valider la progression"><Icon name="check-lg" /></button>
                            <button className="btn-icon text-danger" onClick={() => setEditingProgressId(null)} aria-label="Annuler"><Icon name="x-lg" /></button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${course.progress}%` }}></div>
                        </div>
                        <div className="d-flex justify-content-between align-items-center mt-1">
                          <small className="text-muted">Progression</small>
                          <div className="d-flex align-items-center gap-2">
                            <small className="fw-bold">{course.progress}%</small>
                            <button
                              className="btn-icon progress-edit-btn"
                              onClick={(e) => { e.stopPropagation(); openProgressEditor(course); }}
                              title="Modifier la progression"
                              aria-label="Modifier la progression"
                            >
                              <Icon name="pencil" />
                            </button>
                          </div>
                        </div>
                      </>
                    )
                  )}

                  <div className="course-card-hint">
                    <Icon name="arrow-up-right-circle" /> Voir le cours
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredCourses.length === 0 && courses.length > 0 && (
            <p className="text-muted">Aucun cours ne correspond a "{search}".</p>
          )}
          {courses.length === 0 && <p className="text-muted">Aucun cours pour le moment. Ajoutez-en un !</p>}
        </div>

        <Modal show={showModal} onClose={() => setShowModal(false)} title={editingId ? "Modifier le cours" : "Nouveau cours"}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Titre</label>
              <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="row">
              <div className="col-6 mb-3">
                <label className="form-label">Code</label>
                <input className="form-control" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <div className="col-6 mb-3">
                <label className="form-label">Couleur</label>
                <input type="color" className="form-control form-control-color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}></textarea>
            </div>
            <div className="mb-3">
              <label className="form-label">Progression ({form.progress}%)</label>
              <input type="range" min="0" max="100" className="form-range" value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} />
            </div>
            <button className="btn btn-primary w-100 btn-animated">{editingId ? "Enregistrer" : "Creer le cours"}</button>
          </form>
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Courses;