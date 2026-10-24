import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { LayoutGrid, List as ListIcon, Clock, MapPin, GraduationCap, FolderKanban } from "lucide-react";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import useUndoDelete from "../hooks/useUndoDelete";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import { daysUntil, dueLabel, dueTone, formatShort, isoKey } from "../utils/dateHelpers";
import { pop } from "../utils/motion";
import { apiError } from "../utils/http";

/* ---------------- Constantes ---------------- */

const PROJECT_COLUMNS = [
  { id: "todo", label: "À faire" },
  { id: "in_progress", label: "En cours" },
  { id: "done", label: "Terminé" },
];
const EXAM_COLUMNS = [
  { id: "upcoming", label: "À venir" },
  { id: "past", label: "Passé" },
];
const PRIORITIES = {
  haute: { label: "Haute", cls: "prio-haute" },
  moyenne: { label: "Moyenne", cls: "prio-moyenne" },
  basse: { label: "Basse", cls: "prio-basse" },
};

// "pending" est l'ancien statut : il correspond a "À faire".
const projectStatus = (a) => (a.status === "done" ? "done" : a.status === "in_progress" ? "in_progress" : "todo");
const examStatus = (a) => (a.status === "past" || a.status === "done" ? "past" : "upcoming");
const columnOf = (a) => (a.type === "exam" ? examStatus(a) : projectStatus(a));

const emptyForm = (type) =>
  type === "exam"
    ? { type, title: "", course: "", description: "", dueDate: "", startTime: "08:00", duration: 120, room: "", syllabus: "", reviewNotes: [], status: "upcoming", grade: "" }
    : { type, title: "", course: "", description: "", startDate: "", dueDate: "", status: "todo", progress: 0, priority: "moyenne" };

const toForm = (a) => ({
  type: a.type,
  title: a.title || "",
  course: a.course?._id || a.course || "",
  description: a.description || "",
  startDate: a.startDate ? isoKey(a.startDate) : "",
  dueDate: a.dueDate ? isoKey(a.dueDate) : "",
  status: columnOf(a),
  progress: a.progress ?? 0,
  priority: a.priority || "moyenne",
  startTime: a.startTime || "",
  duration: a.duration || 0,
  room: a.room || "",
  syllabus: a.syllabus || "",
  reviewNotes: (a.reviewNotes || []).map((n) => n._id || n),
  grade: a.grade ?? "",
});

const buildPayload = (f) => {
  const base = { type: f.type, title: f.title.trim(), course: f.course || null, dueDate: f.dueDate, status: f.status };
  if (f.type === "exam") {
    return {
      ...base,
      startTime: f.startTime,
      duration: Number(f.duration) || 0,
      room: f.room,
      syllabus: f.syllabus,
      reviewNotes: f.reviewNotes,
      description: f.description,
      grade: f.grade === "" || f.grade === null ? null : Number(f.grade),
    };
  }
  return {
    ...base,
    description: f.description,
    startDate: f.startDate || null,
    progress: Number(f.progress) || 0,
    priority: f.priority,
  };
};

/* ---------------- Page ---------------- */

const Assignments = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "viewonly" || (user?.role === "user" && !!user?.sponsor);

  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("assignment"); // assignment | exam
  const [view, setView] = useState("board"); // board | list

  const [modal, setModal] = useState(null); // { mode: "create" | "edit" | "view", id? }
  const [form, setForm] = useState(emptyForm("assignment"));
  const [saving, setSaving] = useState(false);

  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const requests = [api.get("/assignments"), api.get("/courses")];
    if (!isReadOnly) requests.push(api.get("/notes"));
    Promise.all(requests)
      .then(([a, c, n]) => {
        setItems(a.data);
        setCourses(c.data);
        if (n) setNotes(n.data);
      })
      .catch((err) => showToast(apiError(err, "Impossible de charger les données"), { type: "error" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  const deleteWithUndo = useUndoDelete({
    setItems,
    removeFn: (id) => api.delete(`/assignments/${id}`),
    getLabel: (item) => item.title,
  });

  // L'API renvoie normalement le cours deja complet ; sinon on le retrouve dans la liste.
  const normalize = (data) => {
    const course = typeof data.course === "string" ? courses.find((c) => c._id === data.course) || data.course : data.course;
    const reviewNotes = (data.reviewNotes || []).map((n) => (typeof n === "string" ? notes.find((x) => x._id === n) || { _id: n, title: "Note" } : n));
    return { ...data, course, reviewNotes };
  };

  // Mise a jour optimiste : l'ecran change tout de suite, et revient en arriere si le serveur refuse.
  const patchItem = async (id, payload) => {
    const before = items;
    setItems((list) => list.map((i) => (i._id === id ? { ...i, ...payload } : i)));
    try {
      const { data } = await api.put(`/assignments/${id}`, payload);
      setItems((list) => list.map((i) => (i._id === id ? normalize(data) : i)));
      return data;
    } catch (err) {
      setItems(before);
      showToast(apiError(err, "Modification impossible"), { type: "error" });
      return null;
    }
  };

  /* ----- Glisser-deposer (natif) ----- */

  const onDragStart = (e, item) => {
    if (isReadOnly) return;
    dragRef.current = item._id;
    setDragId(item._id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item._id);
  };
  const onDragEnd = () => { dragRef.current = null; setDragId(null); setOverCol(null); };

  const dropOnColumn = (e, columnId) => {
    e.preventDefault();
    const id = dragRef.current || e.dataTransfer.getData("text/plain");
    onDragEnd();
    const item = items.find((i) => i._id === id);
    if (!item || isReadOnly || columnOf(item) === columnId) return;
    const payload = { status: columnId };
    if (item.type !== "exam" && columnId === "done") payload.progress = 100; // un projet termine = 100 %
    patchItem(id, payload).then((ok) => ok && showToast("Déplacé", { type: "info" }));
  };

  /* ----- Formulaire ----- */

  const openCreate = () => { setForm(emptyForm(tab)); setModal({ mode: "create" }); };
  const openItem = (item) => { setForm(toForm(item)); setModal({ mode: isReadOnly ? "view" : "edit", id: item._id }); };
  const closeModal = () => setModal(null);

  const setType = (type) => setForm((f) => ({ ...emptyForm(type), title: f.title, course: f.course, dueDate: f.dueDate, description: f.description }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.dueDate) return;
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (modal.mode === "create") {
        const { data } = await api.post("/assignments", payload);
        setItems((list) => [...list, normalize(data)]);
        setTab(form.type); // on affiche l'onglet de l'element cree
        showToast(form.type === "exam" ? "Examen ajouté" : "Projet ajouté", { type: "success" });
      } else {
        const { data } = await api.put(`/assignments/${modal.id}`, payload);
        setItems((list) => list.map((i) => (i._id === modal.id ? normalize(data) : i)));
        showToast("Mis à jour", { type: "success" });
      }
      closeModal();
    } catch (err) {
      showToast(apiError(err, "Enregistrement impossible"), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleShare = (e, item) => {
    e.stopPropagation();
    patchItem(item._id, { sharedWithViewers: !item.sharedWithViewers });
    showToast(item.sharedWithViewers ? "Partage retiré" : "Partagé avec les lecteurs", { type: "info" });
  };

  /* ----- Donnees affichees ----- */

  const shown = items.filter((i) => (tab === "exam" ? i.type === "exam" : i.type !== "exam"));
  const columns = tab === "exam" ? EXAM_COLUMNS : PROJECT_COLUMNS;
  const inColumn = (colId) => {
    const list = shown.filter((i) => columnOf(i) === colId);
    return tab === "exam" && colId === "past" ? [...list].reverse() : list; // examens passes : les plus recents d'abord
  };

  const notesForForm = form.course ? notes.filter((n) => (n.course?._id || n.course) === form.course) : notes;
  const formDisabled = modal?.mode === "view";

  /* ----- Cartes ----- */

  const renderDue = (item) => {
    const finished = columnOf(item) === "done" || columnOf(item) === "past";
    const days = daysUntil(item.dueDate);
    if (finished) return <span className="due-badge due-muted">{formatShort(item.dueDate)}</span>;
    return <span className={`due-badge due-${dueTone(days)}`}><Icon name="calendar-event" className="me-1" size={12} />{dueLabel(days)}</span>;
  };

  const renderActions = (item) =>
    !isReadOnly && (
      <div className="kb-card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn-icon" onClick={(e) => toggleShare(e, item)} aria-label="Basculer le partage" title={item.sharedWithViewers ? "Partagé" : "Non partagé"}>
          <Icon name={item.sharedWithViewers ? "eye" : "eye-slash"} className={item.sharedWithViewers ? "text-success" : "text-muted"} size={15} />
        </button>
        <button className="btn-icon text-danger" onClick={() => deleteWithUndo(item)} aria-label="Supprimer" title="Supprimer"><Icon name="trash" size={15} /></button>
      </div>
    );

  const renderCard = (item) => {
    const isExam = item.type === "exam";
    const color = item.course?.color || "#6c63ff";
    return (
      <motion.div key={item._id} variants={pop} initial="hidden" animate="show" exit="exit" layout="position">
        <div
          className={`kb-card ${dragId === item._id ? "dragging" : ""}`}
          style={{ "--card-accent": color }}
          draggable={!isReadOnly}
          onDragStart={(e) => onDragStart(e, item)}
          onDragEnd={onDragEnd}
          onClick={() => openItem(item)}
        >
          <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
            {isExam ? (
              <span className="type-badge badge-exam">Examen</span>
            ) : (
              <span className={`prio-badge ${PRIORITIES[item.priority || "moyenne"].cls}`}>
                <Icon name="flag" size={11} className="me-1" />{PRIORITIES[item.priority || "moyenne"].label}
              </span>
            )}
            {renderActions(item)}
          </div>

          <h6 className="kb-card-title">{item.title}</h6>
          <div className="kb-card-course">
            <span className="scope-dot" style={{ background: color }} />
            {item.course?.title || "Sans cours"}
          </div>

          {isExam ? (
            <>
              <div className="kb-meta">
                <span><Icon name="calendar-event" size={13} className="me-1" />{formatShort(item.dueDate)}{item.startTime ? ` · ${item.startTime}` : ""}</span>
                {item.duration > 0 && <span><Clock size={13} className="app-icon me-1" />{Math.floor(item.duration / 60)}h{item.duration % 60 ? String(item.duration % 60).padStart(2, "0") : ""}</span>}
                {item.room && <span><MapPin size={13} className="app-icon me-1" />{item.room}</span>}
              </div>
              {item.syllabus && <p className="kb-card-text">{item.syllabus}</p>}
              {(item.reviewNotes || []).length > 0 && (
                <div className="kb-chips" onClick={(e) => e.stopPropagation()}>
                  {item.reviewNotes.map((n) => (
                    <Link key={n._id} to={`/notes/${n._id}`} className="kb-chip" title="Ouvrir la note de révision">{n.title}</Link>
                  ))}
                </div>
              )}
              <div className="d-flex justify-content-between align-items-center mt-2">
                {renderDue(item)}
                {item.grade !== null && item.grade !== undefined && (
                  <span className={`grade-badge ${item.grade >= 10 ? "grade-ok" : "grade-low"}`}>{item.grade}/20</span>
                )}
              </div>
            </>
          ) : (
            <>
              {item.description && <p className="kb-card-text">{item.description}</p>}
              <div className="kb-meta">
                {item.startDate && <span>Début {formatShort(item.startDate)}</span>}
              </div>
              <div className="kb-progress" aria-label={`Progression ${item.progress || 0}%`}>
                <motion.div className="kb-progress-fill" initial={{ width: 0 }} animate={{ width: `${item.progress || 0}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
              </div>
              <div className="d-flex justify-content-between align-items-center mt-1">
                <small className="text-muted">{item.progress || 0}%</small>
                {renderDue(item)}
              </div>
            </>
          )}
        </div>
      </motion.div>
    );
  };

  /* ----- Rendu ----- */

  return (
    <Layout title="Projets Tutorés & Examens">
      <PageWrapper>
        <div className="page-toolbar">
          <div className="seg-control" role="tablist">
            <button role="tab" aria-selected={tab === "assignment"} className={tab === "assignment" ? "active" : ""} onClick={() => setTab("assignment")}>
              <FolderKanban size={15} className="app-icon me-1" />Projets tutorés
              <span className="seg-count">{items.filter((i) => i.type !== "exam").length}</span>
            </button>
            <button role="tab" aria-selected={tab === "exam"} className={tab === "exam" ? "active" : ""} onClick={() => setTab("exam")}>
              <GraduationCap size={15} className="app-icon me-1" />Examens
              <span className="seg-count">{items.filter((i) => i.type === "exam").length}</span>
            </button>
          </div>

          <div className="d-flex gap-2 align-items-center flex-wrap">
            <div className="seg-control seg-small">
              <button className={view === "board" ? "active" : ""} onClick={() => setView("board")} aria-label="Vue tableau"><LayoutGrid size={15} className="app-icon me-1" />Tableau</button>
              <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="Vue liste"><ListIcon size={15} className="app-icon me-1" />Liste</button>
            </div>
            {!isReadOnly && (
              <button className="btn btn-primary btn-animated" onClick={openCreate}>
                <Icon name="plus-lg" className="me-1" />{tab === "exam" ? "Nouvel examen" : "Nouveau projet"}
              </button>
            )}
          </div>
        </div>

        {!isReadOnly && view === "board" && shown.length > 0 && (
          <p className="todo-drag-hint"><Icon name="grip-vertical" size={13} className="me-1" />Glissez une carte dans une autre colonne pour changer son statut</p>
        )}

        {loading && <p className="text-muted">Chargement...</p>}

        {!loading && view === "board" && (
          <div className={`kb-board kb-cols-${columns.length}`}>
            {columns.map((col) => {
              const list = inColumn(col.id);
              return (
                <div
                  key={col.id}
                  className={`kb-col ${overCol === col.id ? "kb-col-over" : ""}`}
                  onDragOver={(e) => { if (!isReadOnly) { e.preventDefault(); setOverCol(col.id); } }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
                  onDrop={(e) => dropOnColumn(e, col.id)}
                >
                  <div className="kb-col-head">
                    <span className={`kb-dot kb-dot-${col.id}`} />
                    <strong>{col.label}</strong>
                    <span className="kb-count">{list.length}</span>
                  </div>
                  <div className="kb-col-body">
                    <AnimatePresence initial={false}>{list.map(renderCard)}</AnimatePresence>
                    {list.length === 0 && <div className="kb-empty">{isReadOnly ? "Rien ici" : "Déposez une carte ici"}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && view === "list" && (
          <div className="panel-card">
            {shown.length === 0 && <p className="text-muted mb-0">Aucun élément.</p>}
            <AnimatePresence initial={false}>
              {shown.map((item, i) => {
                const col = columns.find((c) => c.id === columnOf(item));
                return (
                  <motion.div
                    key={item._id}
                    className="assignment-list-row clickable"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => openItem(item)}
                  >
                    <span className={`kb-dot kb-dot-${columnOf(item)}`} title={col?.label} />
                    <div className="flex-grow-1">
                      <strong className={["done", "past"].includes(columnOf(item)) ? "text-decoration-line-through text-muted" : ""}>{item.title}</strong>
                      <div className="text-muted small">
                        {item.course?.title || "Sans cours"}
                        {item.type === "exam" && item.startTime ? ` · ${item.startTime}` : ""}
                        {item.type === "exam" && item.room ? ` · ${item.room}` : ""}
                      </div>
                    </div>
                    {item.type !== "exam" && (
                      <span className={`prio-badge ${PRIORITIES[item.priority || "moyenne"].cls} d-none d-md-inline-flex`}>{PRIORITIES[item.priority || "moyenne"].label}</span>
                    )}
                    {item.type !== "exam" && <span className="list-progress d-none d-md-block"><span style={{ width: `${item.progress || 0}%` }} /></span>}
                    {item.type === "exam" && item.grade !== null && item.grade !== undefined && (
                      <span className={`grade-badge ${item.grade >= 10 ? "grade-ok" : "grade-low"}`}>{item.grade}/20</span>
                    )}
                    <span className="kb-status-text d-none d-md-inline">{col?.label}</span>
                    {renderDue(item)}
                    {renderActions(item)}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* ---------- Formulaire ---------- */}
        <Modal
          show={!!modal}
          onClose={closeModal}
          title={modal?.mode === "create" ? (form.type === "exam" ? "Nouvel examen" : "Nouveau projet tutoré") : modal?.mode === "view" ? "Détails" : "Modifier"}
        >
          <form onSubmit={handleSubmit}>
            <fieldset disabled={formDisabled} className="form-fieldset">
              {modal?.mode === "create" && (
                <div className="seg-control seg-small mb-3 w-100">
                  <button type="button" className={form.type === "assignment" ? "active" : ""} onClick={() => setType("assignment")}>Projet tutoré</button>
                  <button type="button" className={form.type === "exam" ? "active" : ""} onClick={() => setType("exam")}>Examen</button>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label">{form.type === "exam" ? "Intitulé de l'examen" : "Titre du projet"}</label>
                <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div className="mb-3">
                <label className="form-label">{form.type === "exam" ? "Matière" : "Cours associé"}</label>
                <select className="form-select" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                  <option value="">Aucun</option>
                  {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
              </div>

              {form.type === "exam" ? (
                <>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">Date</label>
                      <input type="date" className="form-control" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">Heure</label>
                      <input type="time" className="form-control" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">Durée (minutes)</label>
                      <input type="number" min="0" step="15" className="form-control" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">Salle</label>
                      <input className="form-control" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Programme / chapitres à réviser</label>
                    <textarea className="form-control" rows="3" value={form.syllabus} onChange={(e) => setForm({ ...form, syllabus: e.target.value })} placeholder="Ex : Chapitres 1 à 4, TD 2 et 3" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Notes de révision liées</label>
                    <div className="note-link-box">
                      {notesForForm.length === 0 && <small className="text-muted">{isReadOnly ? "Aucune" : "Aucune note pour ce choix de matière."}</small>}
                      {notesForForm.map((n) => (
                        <label key={n._id} className="scope-row">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={form.reviewNotes.includes(n._id)}
                            onChange={() => setForm((f) => ({ ...f, reviewNotes: f.reviewNotes.includes(n._id) ? f.reviewNotes.filter((x) => x !== n._id) : [...f.reviewNotes, n._id] }))}
                          />
                          <span>{n.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">Statut</label>
                      <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        {EXAM_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">Note obtenue (/20)</label>
                      <input type="number" min="0" max="20" step="0.25" className="form-control" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="Après l'examen" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="form-label">Description / objectifs</label>
                    <textarea className="form-control" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">Date de début</label>
                      <input type="date" className="form-control" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">Date de livraison</label>
                      <input type="date" className="form-control" required value={form.dueDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">Statut</label>
                      <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value, progress: e.target.value === "done" ? 100 : form.progress })}>
                        {PROJECT_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">Priorité</label>
                      <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                        {Object.entries(PRIORITIES).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Progression ({form.progress}%)</label>
                    <input type="range" min="0" max="100" step="5" className="form-range" value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} />
                  </div>
                </>
              )}
            </fieldset>

            {!formDisabled && (
              <button className="btn btn-primary w-100 btn-animated" disabled={saving}>
                {saving ? "..." : modal?.mode === "create" ? "Ajouter" : "Enregistrer"}
              </button>
            )}
            {formDisabled && <button type="button" className="btn btn-outline-secondary w-100" onClick={closeModal}>Fermer</button>}
          </form>
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Assignments;