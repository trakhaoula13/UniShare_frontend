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
import Icon from "../components/Icon";

const emptyForm = { title: "", content: "", category: "article", course: "", fileName: "", fileType: "", fileUrl: "" };

const Research = () => {
  const { items, setItems, create, update } = useResource("/research");
  const { showToast } = useToast();
  const [courses, setCourses] = useState([]);
  const [tab, setTab] = useState("article");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const [viewingItem, setViewingItem] = useState(null);

  useEffect(() => {
    api.get("/courses").then(({ data }) => setCourses(data));
  }, []);

  const deleteWithUndo = useUndoDelete({
    setItems,
    removeFn: (id) => api.delete(`/research/${id}`),
    getLabel: (item) => item.title,
  });

  const openCreate = () => { setForm({ ...emptyForm, category: tab }); setEditingId(null); setFileError(""); setShowModal(true); };
  const openEdit = (item) => { setForm({ ...item, course: item.course?._id || "" }); setEditingId(item._id); setFileError(""); setShowModal(true); };

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
    const payload = { ...form, course: form.course || undefined };
    if (editingId) await update(editingId, payload);
    else await create(payload);
    setShowModal(false);
    showToast(editingId ? "Element mis a jour" : "Element ajoute", { type: "success" });
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
            {filtered.map((item, i) => (
              <motion.div
                key={item._id}
                className="col-md-6 col-xl-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="note-card research-card h-100 note-card-clickable" onClick={() => setViewingItem(item)}>
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
                  {item.fileUrl && (
                    <a className="pdf-chip" href={item.fileUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <Icon name="file-earmark-pdf-fill" />
                      <span className="text-truncate">{item.fileName}</span>
                      <Icon name="box-arrow-up-right" className="ms-auto" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
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
              <label className="form-label">Notes</label>
              <textarea className="form-control" rows="4" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}></textarea>
            </div>
            <div className="mb-3">
              <label className="form-label">Article / document PDF (optionnel)</label>
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
            <button className="btn btn-primary w-100 btn-animated" disabled={uploading}>{editingId ? "Enregistrer" : "Ajouter"}</button>
          </form>
        </Modal>

        <Modal show={!!viewingItem} onClose={() => setViewingItem(null)} title="Details">
          {viewingItem && (
            <div>
              <span className="badge bg-light text-dark mb-2">
                {viewingItem.category === "thesis" ? "Thèse" : "Projet tutoré / Article"}
              </span>
              <h5 className="fw-bold mb-2">{viewingItem.title}</h5>
              {viewingItem.course && <span className="badge bg-light text-dark mb-3">{viewingItem.course.title}</span>}
              {viewingItem.content && <p className="note-view-content mt-2">{viewingItem.content}</p>}
              {viewingItem.fileUrl && (
                <a className="pdf-chip mt-2" href={viewingItem.fileUrl} target="_blank" rel="noopener noreferrer">
                  <Icon name="file-earmark-pdf-fill" />
                  <span className="text-truncate">{viewingItem.fileName}</span>
                  <Icon name="box-arrow-up-right" className="ms-auto" />
                </a>
              )}
              <div className="d-flex gap-2 mt-4">
                <button className="btn btn-outline-primary flex-grow-1" onClick={() => { setViewingItem(null); openEdit(viewingItem); }}>
                  <Icon name="pencil" className="me-1" />Modifier
                </button>
                <button className="btn btn-outline-secondary flex-grow-1" onClick={() => setViewingItem(null)}>Fermer</button>
              </div>
            </div>
          )}
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Research;
