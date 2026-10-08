import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import useResource from "../hooks/useResource";
import useUndoDelete from "../hooks/useUndoDelete";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";

const emptyForm = { title: "", content: "", category: "article", course: "" };

// Nombre total de fichiers (nouveau format + ancien PDF unique).
const countFiles = (item) => {
  const list = item.files || [];
  const legacy = item.fileUrl && !list.some((f) => f.fileUrl === item.fileUrl) ? 1 : 0;
  return list.length + legacy;
};

const Research = () => {
  const { items, setItems, update } = useResource("/research");
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [courses, setCourses] = useState([]);
  // L'onglet est conserve quand on revient depuis la page de detail.
  const [tab, setTab] = useState(location.state?.tab || "article");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    api.get("/courses").then(({ data }) => setCourses(data));
  }, []);

  const deleteWithUndo = useUndoDelete({
    setItems,
    removeFn: (id) => api.delete(`/research/${id}`),
    getLabel: (item) => item.title,
  });

  const openCreate = () => { setForm({ ...emptyForm, category: tab }); setEditingId(null); setShowModal(true); };
  const openEdit = (item) => {
    setForm({ title: item.title, content: item.content || "", category: item.category, course: item.course?._id || "" });
    setEditingId(item._id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, course: form.course || undefined };
    if (editingId) {
      await update(editingId, payload);
      setShowModal(false);
      showToast("Element mis a jour", { type: "success" });
    } else {
      const { data } = await api.post("/research", payload);
      setShowModal(false);
      showToast("Page creee : ajoutez vos fichiers et notes", { type: "success" });
      // On ouvre directement la nouvelle page pour y ajouter fichiers et notes.
      navigate(`/research/${data._id}`);
    }
  };

  const filtered = items.filter((i) => i.category === tab);

  return (
    <Layout title="Recherche">
      <PageWrapper>
        <div className="d-flex justify-content-between mb-3 flex-wrap gap-2">
          <div className="btn-group filter-group">
            <button className={`btn btn-sm ${tab === "article" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTab("article")}>
              <Icon name="journal-richtext" className="me-1" />Projets tutorés / Articles
            </button>
            <button className={`btn btn-sm ${tab === "thesis" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTab("thesis")}>
              <Icon name="mortarboard" className="me-1" />Thèse
            </button>
          </div>
          <button className="btn btn-primary btn-animated" onClick={openCreate}>
            <Icon name="plus-lg" className="me-1" />Ajouter
          </button>
        </div>

        <div className="row g-3">
          <AnimatePresence>
            {filtered.map((item, i) => {
              const fileCount = countFiles(item);
              const entryCount = (item.entries || []).length;
              return (
                <motion.div
                  key={item._id}
                  className="col-md-6 col-xl-4"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="note-card research-card h-100 note-card-clickable" onClick={() => navigate(`/research/${item._id}`)}>
                    <div className="d-flex justify-content-between align-items-start">
                      <h6 className="fw-bold note-title-clamp">{item.title}</h6>
                      <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                        <button className="btn-icon" data-bs-toggle="dropdown" aria-label="Options"><Icon name="three-dots-vertical" /></button>
                        <ul className="dropdown-menu dropdown-menu-end">
                          <li><button className="dropdown-item" onClick={() => openEdit(item)}><Icon name="pencil" className="me-2" />Modifier</button></li>
                          <li><button className="dropdown-item text-danger" onClick={() => deleteWithUndo(item)}><Icon name="trash" className="me-2" />Supprimer</button></li>
                        </ul>
                      </div>
                    </div>
                    {item.course && <span className="badge bg-light text-dark mb-2">{item.course.title}</span>}
                    {item.content && <p className="text-muted small note-content">{item.content}</p>}
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
          {filtered.length === 0 && (
            <p className="text-muted">
              {tab === "article" ? "Aucun projet tutoré ou article pour le moment." : "Aucune note liée a la these pour le moment."}
            </p>
          )}
        </div>

        <Modal show={showModal} onClose={() => setShowModal(false)} title={editingId ? "Modifier" : "Nouvel element de recherche"}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Categorie</label>
              <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="article">Projet tutoré / Article</option>
                <option value="thesis">Thèse</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Titre</label>
              <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Cours associe (optionnel)</label>
              <select className="form-select" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                <option value="">Aucun</option>
                {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
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

export default Research;