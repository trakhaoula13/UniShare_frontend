import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import useResource from "../hooks/useResource";
import useUndoDelete from "../hooks/useUndoDelete";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const emptyForm = { title: "", description: "", type: "assignment", course: "", dueDate: "", status: "pending" };

const Assignments = () => {
  const { items, setItems, create, update } = useResource("/assignments");
  const { showToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "viewonly" || (user?.role === "user" && !!user?.sponsor);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.get("/courses").then(({ data }) => setCourses(data));
  }, []);

  const deleteWithUndo = useUndoDelete({
    setItems,
    removeFn: (id) => api.delete(`/assignments/${id}`),
    getLabel: (item) => item.title,
  });

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); };
  const openEdit = (item) => {
    setForm({ ...item, course: item.course?._id || "", dueDate: item.dueDate?.slice(0, 10) });
    setEditingId(item._id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, course: form.course || undefined };
    if (editingId) await update(editingId, payload);
    else await create(payload);
    setShowModal(false);
    showToast(editingId ? "Element mis a jour" : "Element ajoute", { type: "success" });
  };

  const toggleStatus = (item) => update(item._id, { status: item.status === "done" ? "pending" : "done" });
  const toggleShare = (item) => {
    update(item._id, { sharedWithViewers: !item.sharedWithViewers });
    showToast(item.sharedWithViewers ? "Partage retire" : "Partage avec les lecteurs", { type: "info" });
  };

  const filtered = items.filter((i) => filter === "all" || i.type === filter);

  return (
    <Layout title="Projets Tutorés & Examens">
      <PageWrapper>
        <div className="d-flex justify-content-between mb-3 flex-wrap gap-2">
          <div className="btn-group filter-group">
            {["all", "assignment", "exam"].map((f) => (
              <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setFilter(f)}>
                {f === "all" ? "Tout" : f === "assignment" ? "Projets Tutorés" : "Examens"}
              </button>
            ))}
          </div>
          {!isReadOnly && (
            <button className="btn btn-primary btn-animated" onClick={openCreate}>
              <Icon name="plus-lg" className="me-1" />Ajouter
            </button>
          )}
        </div>

        <div className="panel-card">
          <AnimatePresence>
            {filtered.map((item, i) => (
              <motion.div
                key={item._id}
                className="assignment-list-row"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ delay: i * 0.03 }}
              >
                <button className="btn-icon" onClick={() => toggleStatus(item)} aria-label={item.status === "done" ? "Marquer comme en attente" : "Marquer comme termine"} disabled={isReadOnly}>
                  <Icon name={item.status === "done" ? "check-circle-fill" : "circle"} className={item.status === "done" ? "text-success" : ""} />
                </button>
                <span className={`type-badge ${item.type === "exam" ? "badge-exam" : "badge-assignment"}`}>
                  {item.type === "exam" ? "Examen" : "Projet Tutoré"}
                </span>
                <div className="flex-grow-1">
                  <strong className={item.status === "done" ? "text-decoration-line-through text-muted" : ""}>{item.title}</strong>
                  <div className="text-muted small">{item.course?.title || "Sans cours"}</div>
                </div>
                <span className="text-muted small me-3">
                  <Icon name="calendar-event" className="me-1" />{new Date(item.dueDate).toLocaleDateString("fr-FR")}
                </span>
                {!isReadOnly && (
                  <>
                    <button className="btn-icon" onClick={() => toggleShare(item)} aria-label="Basculer le partage" title={item.sharedWithViewers ? "Partage" : "Non partage"}>
                      <Icon name={item.sharedWithViewers ? "eye" : "eye-slash"} className={item.sharedWithViewers ? "text-success" : "text-muted"} size={15} />
                    </button>
                    <button className="btn-icon" onClick={() => openEdit(item)} aria-label="Modifier"><Icon name="pencil" /></button>
                    <button className="btn-icon text-danger" onClick={() => deleteWithUndo(item)} aria-label="Supprimer"><Icon name="trash" /></button>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && <p className="text-muted mb-0">Aucun element pour ce filtre.</p>}
        </div>

        <Modal show={showModal} onClose={() => setShowModal(false)} title={editingId ? "Modifier" : "Nouveau projet tutoré / examen"}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Titre</label>
              <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="row">
              <div className="col-6 mb-3">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="assignment">Projet Tutoré</option>
                  <option value="exam">Examen</option>
                </select>
              </div>
              <div className="col-6 mb-3">
                <label className="form-label">Date limite</label>
                <input type="date" className="form-control" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Cours associe</label>
              <select className="form-select" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                <option value="">Aucun</option>
                {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}></textarea>
            </div>
            <button className="btn btn-primary w-100 btn-animated">{editingId ? "Enregistrer" : "Ajouter"}</button>
          </form>
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Assignments;