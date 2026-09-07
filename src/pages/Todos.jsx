import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import useResource from "../hooks/useResource";
import useUndoDelete from "../hooks/useUndoDelete";
import api from "../services/api";
import Icon from "../components/Icon";

const PRIORITIES = {
  urgent: { label: "Urgent", badgeClass: "priority-urgent" },
  important: { label: "Important", badgeClass: "priority-important" },
  normal: { label: "Normal", badgeClass: "priority-normal" },
};

const Todos = () => {
  const { items: todos, setItems: setTodos, create, update } = useResource("/todos");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState("normal");
  const [filter, setFilter] = useState("all");
  const dragIndex = useRef(null);

  const deleteWithUndo = useUndoDelete({
    setItems: setTodos,
    removeFn: (id) => api.delete(`/todos/${id}`),
    getLabel: (todo) => todo.text,
  });

  const addTodo = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await create({ text, priority });
    setText("");
  };

  const toggle = (todo) => update(todo._id, { done: !todo.done });

  const filtered = todos.filter((t) => filter === "all" || t.priority === filter);
  const done = todos.filter((t) => t.done).length;
  const counts = {
    urgent: todos.filter((t) => t.priority === "urgent").length,
    important: todos.filter((t) => t.priority === "important").length,
    normal: todos.filter((t) => t.priority === "normal").length,
  };

  // Glisser-deposer natif (HTML5), actif uniquement sur le filtre "Tout"
  // pour eviter de melanger l'ordre reel avec une vue partielle filtree.
  const reorderEnabled = filter === "all";

  const handleDragStart = (index) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = async (index) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === index) return;

    const reordered = [...todos];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(index, 0, moved);
    setTodos(reordered);

    await api.put("/todos/reorder", { ids: reordered.map((t) => t._id) });
  };

  return (
    <Layout title="To-Do List">
      <PageWrapper>
        <div className="panel-card mb-3">
          <form className="d-flex gap-2 flex-wrap" onSubmit={addTodo}>
            <input className="form-control flex-grow-1" placeholder="Ajouter une tache..." value={text} onChange={(e) => setText(e.target.value)} aria-label="Nouvelle tache" />
            <select className="form-select" style={{ maxWidth: 160 }} value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priorite">
              {Object.entries(PRIORITIES).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>
            <button className="btn btn-primary btn-animated" aria-label="Ajouter la tache"><Icon name="plus-lg" /></button>
          </form>
        </div>

        <div className="row g-2 mb-3">
          <div className="col-4">
            <div className="todo-mini-stat todo-mini-urgent">
              <Icon name="flag" size={14} /><span>{counts.urgent}</span><small>Urgent</small>
            </div>
          </div>
          <div className="col-4">
            <div className="todo-mini-stat todo-mini-important">
              <Icon name="flag" size={14} /><span>{counts.important}</span><small>Important</small>
            </div>
          </div>
          <div className="col-4">
            <div className="todo-mini-stat todo-mini-normal">
              <Icon name="flag" size={14} /><span>{counts.normal}</span><small>Normal</small>
            </div>
          </div>
        </div>

        <div className="panel-card">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div className="btn-group filter-group">
              <button className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setFilter("all")}>Tout</button>
              {Object.entries(PRIORITIES).map(([key, p]) => (
                <button key={key} className={`btn btn-sm ${filter === key ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setFilter(key)}>
                  {p.label}
                </button>
              ))}
            </div>
            <span className="text-muted small">{done} / {todos.length} terminees</span>
          </div>

          {reorderEnabled && todos.length > 1 && (
            <p className="todo-drag-hint"><Icon name="grip-vertical" size={13} className="me-1" />Glissez une tache pour la reordonner</p>
          )}

          <AnimatePresence>
            {filtered.map((todo, i) => (
              <motion.div
                key={todo._id}
                className={`todo-item-row ${todo.done ? "todo-item-done" : ""}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: i * 0.02 }}
                draggable={reorderEnabled}
                onDragStart={() => handleDragStart(i)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(i)}
              >
                {reorderEnabled && (
                  <span className="drag-handle" aria-hidden="true">
                    <Icon name="grip-vertical" size={16} />
                  </span>
                )}
                <button className="btn-icon" onClick={() => toggle(todo)} aria-label={todo.done ? "Marquer comme non terminee" : "Marquer comme terminee"}>
                  <Icon name={todo.done ? "check-square-fill" : "square"} className={todo.done ? "text-success" : ""} />
                </button>
                <span className={`flex-grow-1 ${todo.done ? "text-decoration-line-through text-muted" : ""}`}>{todo.text}</span>
                <span className={`priority-badge ${PRIORITIES[todo.priority || "normal"].badgeClass}`}>
                  <Icon name="flag" size={12} className="me-1" />{PRIORITIES[todo.priority || "normal"].label}
                </span>
                <button className="btn-icon text-danger" onClick={() => deleteWithUndo(todo)} aria-label="Supprimer la tache"><Icon name="trash" /></button>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && <p className="text-muted mb-0">Aucune tache pour ce filtre.</p>}
        </div>
      </PageWrapper>
    </Layout>
  );
};

export default Todos;
