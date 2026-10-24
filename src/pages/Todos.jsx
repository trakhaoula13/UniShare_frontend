import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import useUndoDelete from "../hooks/useUndoDelete";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import Icon from "../components/Icon";
import { daysUntil, dueLabel, dueTone } from "../utils/dateHelpers";
import { apiError } from "../utils/http";
import { pop } from "../utils/motion";

const COLUMNS = [
  { id: "todo", label: "À faire" },
  { id: "in_progress", label: "En cours" },
  { id: "review", label: "En révision" },
  { id: "done", label: "Terminé" },
];

const PRIORITIES = {
  urgent: { label: "Urgent", badgeClass: "priority-urgent" },
  important: { label: "Important", badgeClass: "priority-important" },
  normal: { label: "Normal", badgeClass: "priority-normal" },
};

// "done" (ancienne case a cocher) l'emporte : une tache cochee est dans "Terminé".
const statusOf = (t) => (t.done || t.status === "done" ? "done" : t.status || "todo");

const Todos = () => {
  const { showToast } = useToast();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);

  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [overCard, setOverCard] = useState(null);
  const dragRef = useRef(null);

  useEffect(() => {
    api.get("/todos")
      .then(({ data }) => setTodos(data))
      .catch((err) => showToast(apiError(err, "Impossible de charger les tâches"), { type: "error" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  const deleteWithUndo = useUndoDelete({
    setItems: setTodos,
    removeFn: (id) => api.delete(`/todos/${id}`),
    getLabel: (todo) => todo.text,
  });

  const addTodo = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const payload = { text: text.trim(), priority, status: "todo" };
      if (dueDate) payload.dueDate = dueDate;
      const { data } = await api.post("/todos", payload);
      setTodos((list) => [...list, data]);
      setText("");
      setPriority("normal");
      setDueDate("");
      setShowAdd(false);
      showToast("Tâche ajoutée", { type: "success" });
    } catch (err) {
      showToast(apiError(err, "Ajout impossible"), { type: "error" });
    }
  };

  // Deplace une tache dans une colonne (et, si besoin, avant une autre tache).
  const moveTodo = async (id, targetStatus, beforeId = null) => {
    const moved = todos.find((t) => t._id === id);
    if (!moved) return;

    const updated = { ...moved, status: targetStatus, done: targetStatus === "done" };
    const list = todos.filter((t) => t._id !== id);
    const index = beforeId && beforeId !== id ? list.findIndex((t) => t._id === beforeId) : -1;
    if (index >= 0) list.splice(index, 0, updated);
    else list.push(updated);

    const statusChanged = statusOf(moved) !== targetStatus;
    const orderChanged = list.map((t) => t._id).join() !== todos.map((t) => t._id).join();
    if (!statusChanged && !orderChanged) return;

    const before = todos;
    setTodos(list);
    try {
      if (statusChanged) await api.put(`/todos/${id}`, { status: targetStatus });
      if (orderChanged) await api.put("/todos/reorder", { ids: list.map((t) => t._id) });
    } catch (err) {
      setTodos(before);
      showToast(apiError(err, "Déplacement impossible"), { type: "error" });
    }
  };

  const toggle = (todo) => moveTodo(todo._id, statusOf(todo) === "done" ? "todo" : "done");

  /* ----- Glisser-deposer (natif) ----- */

  const onDragStart = (e, todo) => {
    dragRef.current = todo._id;
    setDragId(todo._id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", todo._id);
  };
  const onDragEnd = () => { dragRef.current = null; setDragId(null); setOverCol(null); setOverCard(null); };

  const dropOn = (e, columnId, beforeId = null) => {
    e.preventDefault();
    e.stopPropagation();
    const id = dragRef.current || e.dataTransfer.getData("text/plain");
    onDragEnd();
    if (id) moveTodo(id, columnId, beforeId);
  };

  /* ----- Donnees affichees ----- */

  const visible = todos.filter((t) => filter === "all" || t.priority === filter);
  const done = todos.filter((t) => statusOf(t) === "done").length;
  const counts = {
    urgent: todos.filter((t) => t.priority === "urgent").length,
    important: todos.filter((t) => t.priority === "important").length,
    normal: todos.filter((t) => t.priority === "normal").length,
  };

  const renderCard = (todo, columnId) => {
    const prio = PRIORITIES[todo.priority || "normal"];
    const isDone = columnId === "done";
    const days = todo.dueDate ? daysUntil(todo.dueDate) : null;
    return (
      <motion.div key={todo._id} variants={pop} initial="hidden" animate="show" exit="exit" layout="position">
        <div
          className={`kb-card kb-card-todo ${dragId === todo._id ? "dragging" : ""} ${overCard === todo._id && dragId !== todo._id ? "kb-card-over" : ""} ${isDone ? "kb-card-done" : ""}`}
          draggable
          onDragStart={(e) => onDragStart(e, todo)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOverCol(columnId); setOverCard(todo._id); }}
          onDrop={(e) => dropOn(e, columnId, todo._id)}
        >
          <div className="d-flex align-items-start gap-2">
            <button className="btn-icon btn-icon-sm" onClick={() => toggle(todo)} aria-label={isDone ? "Marquer comme non terminée" : "Marquer comme terminée"}>
              <Icon name={isDone ? "check-square-fill" : "square"} className={isDone ? "text-success" : ""} />
            </button>
            <span className={`flex-grow-1 kb-todo-text ${isDone ? "text-decoration-line-through text-muted" : ""}`}>{todo.text}</span>
            <button className="btn-icon btn-icon-sm text-danger" onClick={() => deleteWithUndo(todo)} aria-label="Supprimer la tâche"><Icon name="trash" size={14} /></button>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
            <span className={`priority-badge ${prio.badgeClass}`}><Icon name="flag" size={12} className="me-1" />{prio.label}</span>
            {days !== null && !isDone && (
              <span className={`due-badge due-${dueTone(days)}`}><Icon name="calendar-event" size={12} className="me-1" />{dueLabel(days)}</span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <Layout title="To-Do List">
      <PageWrapper>
        <div className="page-toolbar">
          {/* Priorites : badges qui servent aussi de filtres */}
          <div className="prio-chips" role="group" aria-label="Filtrer par priorité">
            <button type="button" className={`prio-chip prio-chip-all ${filter === "all" ? "active" : ""}`} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              Tout <b>{todos.length}</b>
            </button>
            {Object.entries(PRIORITIES).map(([key, p]) => (
              <button
                key={key}
                type="button"
                className={`prio-chip priority-badge ${p.badgeClass} ${filter === key ? "active" : ""}`}
                aria-pressed={filter === key}
                onClick={() => setFilter(filter === key ? "all" : key)}
              >
                <Icon name="flag" size={13} />{p.label}<b>{counts[key]}</b>
              </button>
            ))}
          </div>

          <div className="d-flex align-items-center gap-3 flex-wrap">
            <span className="text-muted small">{done} / {todos.length} terminées</span>
            <button className="btn btn-primary btn-animated" onClick={() => setShowAdd(true)}>
              <Icon name="plus-lg" className="me-1" />Nouvelle tâche
            </button>
          </div>
        </div>

        {todos.length > 1 && <p className="todo-drag-hint"><Icon name="grip-vertical" size={13} className="me-1" />Glissez une carte dans une colonne, ou au-dessus d'une autre carte pour la réordonner</p>}

        {loading && <p className="text-muted">Chargement...</p>}

        {!loading && (
          <div className="kb-board kb-cols-4">
            {COLUMNS.map((col) => {
              const list = visible.filter((t) => statusOf(t) === col.id);
              return (
                <div
                  key={col.id}
                  className={`kb-col ${overCol === col.id ? "kb-col-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); setOverCard(null); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setOverCol(null); setOverCard(null); } }}
                  onDrop={(e) => dropOn(e, col.id)}
                >
                  <div className="kb-col-head">
                    <span className={`kb-dot kb-dot-${col.id}`} />
                    <strong>{col.label}</strong>
                    <span className="kb-count">{list.length}</span>
                  </div>
                  <div className="kb-col-body">
                    <AnimatePresence initial={false}>{list.map((t) => renderCard(t, col.id))}</AnimatePresence>
                    {list.length === 0 && <div className="kb-empty">Déposez une tâche ici</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Modal show={showAdd} onClose={() => setShowAdd(false)} title="Nouvelle tâche">
          <form onSubmit={addTodo}>
            <div className="mb-3">
              <label className="form-label">Tâche</label>
              <input className="form-control" autoFocus required value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex : Rendre le rapport de TP" />
            </div>
            <div className="mb-3">
              <label className="form-label">Priorité</label>
              <div className="prio-chips">
                {Object.entries(PRIORITIES).map(([key, p]) => (
                  <button
                    key={key}
                    type="button"
                    className={`prio-chip priority-badge ${p.badgeClass} ${priority === key ? "active" : ""}`}
                    aria-pressed={priority === key}
                    onClick={() => setPriority(key)}
                  >
                    <Icon name="flag" size={13} />{p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Échéance (optionnel)</label>
              <input type="date" className="form-control" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <button className="btn btn-primary w-100 btn-animated" disabled={!text.trim()}>Ajouter</button>
          </form>
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Todos;