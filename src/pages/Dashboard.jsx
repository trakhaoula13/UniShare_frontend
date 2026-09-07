import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import Icon from "../components/Icon";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";

const emptyLinkForm = { label: "", url: "", icon: "link-45deg" };

const Dashboard = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [stats, setStats] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [todos, setTodos] = useState([]);
  const [links, setLinks] = useState([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState(emptyLinkForm);
  const [editingLinkId, setEditingLinkId] = useState(null);

  const loadAll = async () => {
    const [statsRes, assignRes, todosRes, linksRes] = await Promise.all([
      api.get("/stats/me"),
      api.get("/assignments"),
      api.get("/todos"),
      api.get("/quicklinks"),
    ]);
    setStats(statsRes.data);
    setAssignments(assignRes.data.slice(0, 5));
    setTodos(todosRes.data.slice(0, 5));
    setLinks(linksRes.data);
  };

  useEffect(() => { loadAll(); }, []);

  const openCreateLink = () => { setLinkForm(emptyLinkForm); setEditingLinkId(null); setShowLinkModal(true); };
  const openEditLink = (link) => { setLinkForm(link); setEditingLinkId(link._id); setShowLinkModal(true); };

  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    let url = linkForm.url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const payload = { ...linkForm, url };
    if (editingLinkId) await api.put(`/quicklinks/${editingLinkId}`, payload);
    else await api.post("/quicklinks", payload);
    setShowLinkModal(false);
    showToast(editingLinkId ? "Lien mis a jour" : "Lien ajoute", { type: "success" });
    loadAll();
  };

  const handleLinkDelete = async (link) => {
    const ok = await confirm(`Supprimer le lien "${link.label}" ?`);
    if (!ok) return;
    await api.delete(`/quicklinks/${link._id}`);
    showToast("Lien supprime", { type: "info" });
    loadAll();
  };

  return (
    <Layout title={<>Bonjour, {user?.name?.split(" ")[0]} <Icon name="stars" className="text-warning" /></>}>
      <PageWrapper>
        <div className="row g-3 mb-4">
          <StatCard icon="book" label="Cours actifs" value={stats?.coursesCount ?? "-"} color="primary" delay={0} />
          <StatCard icon="hourglass-split" label="En attente" value={stats?.pendingAssignments ?? "-"} color="warning" delay={0.05} />
          <StatCard icon="check-circle" label="Termines" value={stats?.doneAssignments ?? "-"} color="success" delay={0.1} />
          <StatCard icon="list-check" label="Taches (total)" value={stats?.todosCount ?? "-"} color="info" delay={0.15} />
        </div>

        <div className="row g-3">
          <motion.div className="col-lg-7" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="panel-card h-100">
              <div className="panel-header">
                <h5><Icon name="clipboard-check" className="me-2" />Prochains projets tutorés & examens</h5>
              </div>
              {assignments.length === 0 && <p className="text-muted">Rien de prevu pour le moment.</p>}
              <ul className="list-unstyled">
                {assignments.map((a, i) => (
                  <motion.li
                    key={a._id}
                    className="assignment-row"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                  >
                    <span className={`type-dot ${a.type === "exam" ? "dot-exam" : "dot-assignment"}`}></span>
                    <div className="flex-grow-1">
                      <strong>{a.title}</strong>
                      <div className="text-muted small">{a.course?.title || "Sans cours"}</div>
                    </div>
                    <span className="badge bg-light text-dark">
                      {new Date(a.dueDate).toLocaleDateString("fr-FR")}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>

          <motion.div className="col-lg-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="panel-card h-100">
              <div className="panel-header">
                <h5><Icon name="check2-square" className="me-2" />Taches rapides</h5>
              </div>
              {todos.length === 0 && <p className="text-muted">Aucune tache pour le moment.</p>}
              <ul className="list-unstyled">
                {todos.map((t, i) => (
                  <motion.li
                    key={t._id}
                    className="todo-row"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                  >
                    <Icon name={t.done ? "check-square-fill" : "square"} className={t.done ? "text-success" : ""} />
                    <span className={t.done ? "text-decoration-line-through text-muted" : ""}>{t.text}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>

          <motion.div className="col-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="panel-card">
              <div className="panel-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h5 className="mb-0"><Icon name="link-45deg" className="me-2" />Liens rapides</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={openCreateLink}>
                  <Icon name="plus-lg" className="me-1" />Ajouter un lien
                </button>
              </div>
              <div className="quicklinks-grid mt-2">
                <AnimatePresence>
                  {links.map((link, i) => (
                    <motion.div
                      key={link._id}
                      className="quicklink-chip"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="quicklink-main">
                        <Icon name={link.icon || "link-45deg"} />
                        <span>{link.label}</span>
                      </a>
                      <div className="dropdown">
                        <button className="btn-icon" data-bs-toggle="dropdown" aria-label="Options du lien"><Icon name="three-dots-vertical" /></button>
                        <ul className="dropdown-menu dropdown-menu-end">
                          <li><button className="dropdown-item" onClick={() => openEditLink(link)}><Icon name="pencil" className="me-2" />Modifier</button></li>
                          <li><button className="dropdown-item text-danger" onClick={() => handleLinkDelete(link)}><Icon name="trash" className="me-2" />Supprimer</button></li>
                        </ul>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {links.length === 0 && <p className="text-muted mb-0">Aucun lien pour le moment. Ajoutez vos sites favoris.</p>}
              </div>
            </div>
          </motion.div>
        </div>

        <Modal show={showLinkModal} onClose={() => setShowLinkModal(false)} title={editingLinkId ? "Modifier le lien" : "Nouveau lien rapide"}>
          <form onSubmit={handleLinkSubmit}>
            <div className="mb-3">
              <label className="form-label">Nom</label>
              <input className="form-control" required placeholder="Ex: Google Scholar" value={linkForm.label} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">URL</label>
              <input className="form-control" required placeholder="Ex: scholar.google.com" value={linkForm.url} onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })} />
            </div>
            <div className="mb-3">
              <label className="form-label">Icone</label>
              <input className="form-control" placeholder="Ex: mortarboard, book, globe..." value={linkForm.icon} onChange={(e) => setLinkForm({ ...linkForm, icon: e.target.value })} />
              <small className="text-muted">Nom d'icone (ex: book, globe, search, mortarboard)</small>
            </div>
            <button className="btn btn-primary w-100 btn-animated">{editingLinkId ? "Enregistrer" : "Ajouter"}</button>
          </form>
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Dashboard;
