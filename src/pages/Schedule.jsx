import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, List as ListIcon, ClipboardList } from "lucide-react";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import useUndoDelete from "../hooks/useUndoDelete";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import { DAYS, MONTHS, addDays, isoKey, isSameDay, minToTime, startOfDay, startOfWeek, timeToMin, toKey, weekdayIndex } from "../utils/dateHelpers";
import { computeDrop, hourRange, layoutDay } from "../utils/calendarLayout";
import { apiError } from "../utils/http";

const HOUR_PX = 56;
const PALETTE = ["#6c63ff", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#8b5cf6"];
const hashColor = (s = "") => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

const emptyForm = { day: "Lundi", startTime: "08:00", endTime: "10:00", subject: "", room: "", type: "Cours", repeat: "weekly", date: "", startDate: "", endDate: "" };

const REPEATS = [
  { value: "none", label: "Une seule fois" },
  { value: "weekly", label: "Chaque semaine" },
  { value: "biweekly", label: "Toutes les 2 semaines" },
];
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (k) => parseKey(k).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

// La séance a-t-elle lieu à cette date ? (les anciennes séances sans "repeat" sont hebdomadaires)
const occursOn = (item, date) => {
  const key = dateKey(date);
  const repeat = item.repeat || "weekly";
  if (repeat === "none") return item.date === key;
  if (item.day !== DAYS[weekdayIndex(date)]) return false;
  if (item.startDate && key < item.startDate) return false;
  if (item.endDate && key > item.endDate) return false;
  if (repeat === "biweekly" && item.startDate) {
    const weeks = Math.round((startOfWeek(date) - startOfWeek(parseKey(item.startDate))) / (7 * 24 * 3600 * 1000));
    return weeks % 2 === 0;
  }
  return true;
};
const repeatLabel = (item) => {
  const repeat = item.repeat || "weekly";
  if (repeat === "none") return "Ponctuelle";
  const base = repeat === "biweekly" ? "Toutes les 2 semaines" : "Chaque semaine";
  return item.endDate ? `${base} · jusqu'au ${fmtDate(item.endDate)}` : base;
};
const FINISHED = ["done", "past"];

const Schedule = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "viewonly" || (user?.role === "user" && !!user?.sponsor);

  const [items, setItems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("week"); // week | month | list
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));

  const [modal, setModal] = useState(null); // { mode: "create" | "edit" | "view", id? }
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [dragId, setDragId] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const dragRef = useRef(null);

  useEffect(() => {
    Promise.all([api.get("/schedule"), api.get("/courses"), api.get("/assignments").catch(() => ({ data: [] }))])
      .then(([s, c, a]) => { setItems(s.data); setCourses(c.data); setAssignments(a.data); })
      .catch((err) => showToast(apiError(err, "Impossible de charger l'emploi du temps"), { type: "error" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  const deleteWithUndo = useUndoDelete({
    setItems,
    removeFn: (id) => api.delete(`/schedule/${id}`),
    getLabel: (item) => `${item.subject} (${item.day})`,
  });

  // Une couleur par matiere : celle du cours si elle existe, sinon une couleur stable.
  const colorFor = (subject) => courses.find((c) => c.title === subject)?.color || hashColor(subject);
  const subjects = useMemo(() => [...new Set(items.map((i) => i.subject))], [items]);

  // Echeances (projets / examens) par jour
  const deadlinesByKey = useMemo(() => {
    const map = {};
    assignments.forEach((a) => { (map[isoKey(a.dueDate)] = map[isoKey(a.dueDate)] || []).push(a); });
    return map;
  }, [assignments]);

  // Mise a jour optimiste d'une seance
  const patchItem = async (id, payload) => {
    const before = items;
    setItems((list) => list.map((i) => (i._id === id ? { ...i, ...payload } : i)));
    try {
      const { data } = await api.put(`/schedule/${id}`, payload);
      setItems((list) => list.map((i) => (i._id === id ? data : i)));
      return true;
    } catch (err) {
      setItems(before);
      showToast(apiError(err, "Modification impossible"), { type: "error" });
      return false;
    }
  };

  /* ---------------- Navigation ---------------- */

  const step = (dir) => setCursor((c) => (view === "month" ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, 7 * dir)));
  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const label = view === "month"
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : `${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()].slice(0, 4)}. – ${weekDays[6].getDate()} ${MONTHS[weekDays[6].getMonth()].slice(0, 4)}. ${weekDays[6].getFullYear()}`;

  /* ---------------- Formulaire ---------------- */

  const openCreate = (preset = {}) => { setForm({ ...emptyForm, date: dateKey(new Date()), ...preset }); setModal({ mode: "create" }); };
  const openItem = (item) => {
    setForm({
      day: item.day, startTime: item.startTime, endTime: item.endTime, subject: item.subject, room: item.room || "", type: item.type || "Cours",
      repeat: item.repeat || "weekly", date: item.date || dateKey(new Date()), startDate: item.startDate || "", endDate: item.endDate || "",
    });
    setModal({ mode: isReadOnly ? "view" : "edit", id: item._id });
  };
  const closeModal = () => setModal(null);
  const editing = modal?.id ? items.find((i) => i._id === modal.id) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (timeToMin(form.endTime) <= timeToMin(form.startTime)) {
      showToast("L'heure de fin doit être après l'heure de début", { type: "error" });
      return;
    }
    if (form.repeat === "none" && !form.date) {
      showToast("Choisissez la date de la séance", { type: "error" });
      return;
    }
    if (form.repeat === "biweekly" && !form.startDate) {
      showToast("Indiquez la date de début pour une séance toutes les 2 semaines", { type: "error" });
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      showToast("La date de fin doit être après la date de début", { type: "error" });
      return;
    }
    const payload = form.repeat === "none"
      ? { ...form, day: DAYS[weekdayIndex(parseKey(form.date))], startDate: "", endDate: "" }
      : { ...form, date: "" };
    setSaving(true);
    try {
      if (modal.mode === "create") {
        const { data } = await api.post("/schedule", payload);
        setItems((list) => [...list, data]);
        showToast("Séance ajoutée", { type: "success" });
      } else {
        const ok = await patchItem(modal.id, payload);
        if (ok) showToast("Séance modifiée", { type: "success" });
      }
      closeModal();
    } catch (err) {
      showToast(apiError(err, "Enregistrement impossible"), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleShare = (item) => {
    patchItem(item._id, { sharedWithViewers: !item.sharedWithViewers });
    showToast(item.sharedWithViewers ? "Partage retiré" : "Séance partagée", { type: "info" });
  };

  /* ---------------- Glisser-deposer ---------------- */

  const startDrag = (e, item, offsetY = 0) => {
    if (isReadOnly) return;
    dragRef.current = { id: item._id, offsetY, duration: Math.max(timeToMin(item.endTime) - timeToMin(item.startTime), 15) };
    setDragId(item._id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item._id);
  };
  const endDrag = () => { dragRef.current = null; setDragId(null); setOverKey(null); };

  // Semaine : le jour ET l'heure changent
  const dropOnDay = (e, dayIdx, range) => {
    e.preventDefault();
    const drag = dragRef.current;
    endDrag();
    if (!drag || isReadOnly) return;
    const item = items.find((i) => i._id === drag.id);
    if (!item) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { start, end } = computeDrop({ clientY: e.clientY, columnTop: rect.top, offsetY: drag.offsetY, hourPx: HOUR_PX, startHour: range.startHour, endHour: range.endHour, duration: drag.duration });
    const payload = { day: DAYS[dayIdx], startTime: minToTime(start), endTime: minToTime(end) };
    const once = item.repeat === "none";
    if (once) payload.date = dateKey(weekDays[dayIdx]); // séance ponctuelle : on change la date exacte
    if (payload.day === item.day && payload.startTime === item.startTime && (!once || payload.date === item.date)) return;
    patchItem(item._id, payload).then((ok) => ok && showToast(`Déplacé : ${payload.day} ${payload.startTime}`, { type: "info" }));
  };

  // Mois : séance répétée = seul le jour de la semaine change ; séance ponctuelle = la date change
  const dropOnDate = (e, date) => {
    e.preventDefault();
    const drag = dragRef.current;
    endDrag();
    if (!drag || isReadOnly) return;
    const item = items.find((i) => i._id === drag.id);
    const day = DAYS[weekdayIndex(date)];
    if (!item) return;
    if (item.repeat === "none") {
      const key = dateKey(date);
      if (item.date === key) return;
      patchItem(item._id, { day, date: key }).then((ok) => ok && showToast(`Séance déplacée au ${fmtDate(key)}`, { type: "info" }));
      return;
    }
    if (item.day === day) return;
    patchItem(item._id, { day }).then((ok) => ok && showToast(`Séance déplacée au ${day} (chaque semaine)`, { type: "info" }));
  };

  /* ---------------- Rendus ---------------- */

  const deadlineChip = (a) => (
    <span key={a._id} className={`cal-deadline cal-deadline-${a.type === "exam" ? "exam" : "project"} ${FINISHED.includes(a.status) ? "cal-deadline-done" : ""}`} title={`${a.type === "exam" ? "Examen" : "Livraison"} : ${a.title}`}>
      <ClipboardList size={11} className="app-icon" />{a.title}
    </span>
  );

  const renderWeek = () => {
    const range = hourRange(items);
    const hours = Array.from({ length: range.endHour - range.startHour }, (_, i) => range.startHour + i);
    const bodyHeight = hours.length * HOUR_PX;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    return (
      <div className="cal-scroll">
        <div className="cal-week">
          <div className="cal-week-head">
            <div className="cal-corner" />
            {weekDays.map((d, i) => {
              const dl = deadlinesByKey[toKey(d)] || [];
              return (
                <div key={i} className={`cal-day-head ${isSameDay(d, new Date()) ? "today" : ""}`}>
                  <span className="cal-day-name">{DAYS[i].slice(0, 3)}</span>
                  <span className="cal-day-num">{d.getDate()}</span>
                  {dl.length > 0 && <div className="cal-deadlines">{dl.slice(0, 2).map(deadlineChip)}{dl.length > 2 && <span className="cal-more">+{dl.length - 2}</span>}</div>}
                </div>
              );
            })}
          </div>

          <div className="cal-week-body" style={{ height: bodyHeight }}>
            <div className="cal-time-col">
              {hours.map((h) => <div key={h} className="cal-time-label" style={{ height: HOUR_PX }}>{String(h).padStart(2, "0")}:00</div>)}
            </div>

            {weekDays.map((d, idx) => {
              const dayItems = items.filter((i) => occursOn(i, d));
              const placed = layoutDay(dayItems);
              const isToday = isSameDay(d, new Date());
              return (
                <div
                  key={idx}
                  className={`cal-day-col ${isToday ? "today" : ""} ${overKey === `d${idx}` ? "cal-over" : ""}`}
                  style={{ height: bodyHeight, "--hour-px": `${HOUR_PX}px` }}
                  onDragOver={(e) => { if (!isReadOnly) { e.preventDefault(); setOverKey(`d${idx}`); } }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverKey(null); }}
                  onDrop={(e) => dropOnDay(e, idx, range)}
                  onDoubleClick={(e) => {
                    if (isReadOnly) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const { start, end } = computeDrop({ clientY: e.clientY, columnTop: rect.top, offsetY: 0, hourPx: HOUR_PX, startHour: range.startHour, endHour: range.endHour, duration: 90, step: 30 });
                    openCreate({ day: DAYS[idx], startTime: minToTime(start), endTime: minToTime(end) });
                  }}
                >
                  {isToday && nowMin >= range.startHour * 60 && nowMin <= range.endHour * 60 && (
                    <div className="cal-now" style={{ top: ((nowMin - range.startHour * 60) / 60) * HOUR_PX }} />
                  )}
                  {placed.map(({ item, start, end, lane, lanes }) => {
                    const color = colorFor(item.subject);
                    const height = Math.max(((end - start) / 60) * HOUR_PX - 3, 24);
                    return (
                      <div
                        key={item._id}
                        className={`cal-event ${dragId === item._id ? "dragging" : ""} ${isReadOnly ? "" : "cal-event-draggable"}`}
                        style={{
                          top: ((start - range.startHour * 60) / 60) * HOUR_PX + 1,
                          height,
                          left: `calc(${(lane / lanes) * 100}% + 2px)`,
                          width: `calc(${100 / lanes}% - 4px)`,
                          "--ev-color": color,
                        }}
                        draggable={!isReadOnly}
                        onDragStart={(e) => startDrag(e, item, e.clientY - e.currentTarget.getBoundingClientRect().top)}
                        onDragEnd={endDrag}
                        onClick={() => openItem(item)}
                        onDoubleClick={(e) => e.stopPropagation()}
                        title={`${item.subject} · ${item.startTime}–${item.endTime}`}
                      >
                        <span className="cal-event-time">{item.startTime}–{item.endTime}</span>
                        <strong className="cal-event-title">{item.subject}</strong>
                        {height > 58 && (item.room || item.type) && <span className="cal-event-sub">{item.type}{item.room ? ` · ${item.room}` : ""}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMonth = () => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const weeks = Math.ceil((weekdayIndex(first) + daysInMonth) / 7);
    const gridStart = startOfWeek(first);
    const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

    return (
      <div className="cal-scroll">
        <div className="cal-month">
          {DAYS.map((d) => <div key={d} className="cal-month-dayname">{d.slice(0, 3)}</div>)}
          {cells.map((date) => {
            const key = toKey(date);
            const inMonth = date.getMonth() === cursor.getMonth();
            const sessions = items.filter((i) => occursOn(i, date)).sort((a, b) => a.startTime.localeCompare(b.startTime));
            const dl = deadlinesByKey[key] || [];
            return (
              <div
                key={key}
                className={`cal-cell ${inMonth ? "" : "out"} ${isSameDay(date, new Date()) ? "today" : ""} ${overKey === key ? "cal-over" : ""}`}
                onDragOver={(e) => { if (!isReadOnly) { e.preventDefault(); setOverKey(key); } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverKey(null); }}
                onDrop={(e) => dropOnDate(e, date)}
              >
                <span className="cal-cell-num">{date.getDate()}</span>
                {dl.slice(0, 2).map(deadlineChip)}
                {sessions.slice(0, 3).map((s) => (
                  <div
                    key={s._id}
                    className={`cal-chip ${dragId === s._id ? "dragging" : ""}`}
                    style={{ "--ev-color": colorFor(s.subject) }}
                    draggable={!isReadOnly}
                    onDragStart={(e) => startDrag(e, s)}
                    onDragEnd={endDrag}
                    onClick={() => openItem(s)}
                    title={`${s.subject} · ${s.startTime}–${s.endTime}`}
                  >
                    <span className="cal-chip-time">{s.startTime}</span> {s.subject}
                  </div>
                ))}
                {sessions.length > 3 && <span className="cal-more">+{sessions.length - 3} autres</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderList = () => (
    <div className="table-responsive panel-card">
      <table className="table schedule-table align-middle">
        <thead><tr><th>Jour</th><th>Horaire</th><th>Matière</th><th>Salle</th><th>Type</th><th></th></tr></thead>
        <tbody>
          {[...items].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.startTime.localeCompare(b.startTime)).map((item) => (
            <tr key={item._id}>
              <td className="fw-semibold">
                {item.repeat === "none" && item.date ? `${item.day} ${fmtDate(item.date)}` : item.day}
                <div className="small text-muted fw-normal">{repeatLabel(item)}</div>
              </td>
              <td>{item.startTime} - {item.endTime}</td>
              <td><span className="scope-dot me-2" style={{ background: colorFor(item.subject) }} />{item.subject}</td>
              <td>{item.room || "-"}</td>
              <td><span className={`type-badge badge-${(item.type || "Cours").toLowerCase()}`}>{item.type}</span></td>
              <td>
                {!isReadOnly && (
                  <div className="d-flex gap-1">
                    <button className="btn-icon" onClick={() => toggleShare(item)} aria-label="Basculer le partage" title={item.sharedWithViewers ? "Partagé" : "Non partagé"}>
                      <Icon name={item.sharedWithViewers ? "eye" : "eye-slash"} className={item.sharedWithViewers ? "text-success" : "text-muted"} size={15} />
                    </button>
                    <button className="btn-icon" onClick={() => openItem(item)} aria-label="Modifier la séance"><Icon name="pencil" /></button>
                    <button className="btn-icon text-danger" onClick={() => deleteWithUndo(item)} aria-label="Supprimer la séance"><Icon name="trash" /></button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan="6" className="text-center text-muted py-4">Aucune séance planifiée.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const formDisabled = modal?.mode === "view";
  const subjectOptions = [...new Set([...courses.map((c) => c.title), form.subject].filter(Boolean))];

  return (
    <Layout title="Emploi du temps">
      <PageWrapper>
        <div className="page-toolbar">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {view !== "list" && (
              <>
                <div className="cal-nav">
                  <button className="btn-icon" onClick={() => step(-1)} aria-label="Précédent"><ChevronLeft size={18} className="app-icon" /></button>
                  <button className="btn-icon" onClick={() => step(1)} aria-label="Suivant"><ChevronRight size={18} className="app-icon" /></button>
                </div>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setCursor(startOfDay(new Date()))}>Aujourd'hui</button>
                <h5 className="cal-title mb-0">{label}</h5>
              </>
            )}
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="seg-control seg-small">
              <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}><CalendarDays size={15} className="app-icon me-1" />Semaine</button>
              <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}><LayoutGrid size={15} className="app-icon me-1" />Mois</button>
              <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><ListIcon size={15} className="app-icon me-1" />Liste</button>
            </div>
            {!isReadOnly && (
              <button className="btn btn-primary btn-animated" onClick={() => openCreate()}>
                <Icon name="plus-lg" className="me-1" />Ajouter une séance
              </button>
            )}
          </div>
        </div>

        {subjects.length > 0 && view !== "list" && (
          <div className="cal-legend">
            {subjects.map((s) => <span key={s}><span className="scope-dot" style={{ background: colorFor(s) }} />{s}</span>)}
          </div>
        )}
        {!isReadOnly && view !== "list" && items.length > 0 && (
          <p className="todo-drag-hint">
            <Icon name="grip-vertical" size={13} className="me-1" />
            {view === "week" ? "Glissez une séance pour changer son jour ou son heure · double-clic sur une case vide pour en ajouter une" : "Glissez une séance sur un autre jour : une séance répétée change de jour de la semaine, une séance ponctuelle change de date"}
          </p>
        )}

        {loading ? <p className="text-muted">Chargement...</p> : (
          <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {view === "week" && renderWeek()}
            {view === "month" && renderMonth()}
            {view === "list" && renderList()}
          </motion.div>
        )}

        <Modal show={!!modal} onClose={closeModal} title={modal?.mode === "create" ? "Nouvelle séance" : modal?.mode === "view" ? "Séance" : "Modifier la séance"}>
          <form onSubmit={handleSubmit}>
            <fieldset disabled={formDisabled} className="form-fieldset">
              <div className="row">
                <div className="col-6 mb-3">
                  <label className="form-label">Répétition</label>
                  <select className="form-select" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>
                    {REPEATS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="col-6 mb-3">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option>Cours</option><option>TD</option><option>TP</option><option>Examen</option>
                  </select>
                </div>
              </div>
              {form.repeat === "none" ? (
                <div className="mb-3">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="form-label">Jour</label>
                    <select className="form-select" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                      {DAYS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">À partir du{form.repeat === "weekly" ? " (optionnel)" : ""}</label>
                      <input type="date" className="form-control" required={form.repeat === "biweekly"} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">Jusqu'au (optionnel)</label>
                      <input type="date" className="form-control" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
              <div className="row">
                <div className="col-6 mb-3">
                  <label className="form-label">Heure début</label>
                  <input type="time" className="form-control" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div className="col-6 mb-3">
                  <label className="form-label">Heure fin</label>
                  <input type="time" className="form-control" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Matière</label>
                <select className="form-select" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                  <option value="">Choisir un cours...</option>
                  {subjectOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {courses.length === 0 && <small className="text-muted">Aucun cours créé. Ajoutez d'abord un cours dans "Cours".</small>}
              </div>
              <div className="mb-3">
                <label className="form-label">Salle</label>
                <input className="form-control" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
              </div>
            </fieldset>

            {!formDisabled && <button className="btn btn-primary w-100 btn-animated" disabled={saving}>{saving ? "..." : modal?.mode === "create" ? "Ajouter" : "Enregistrer"}</button>}
            {formDisabled && <button type="button" className="btn btn-outline-secondary w-100" onClick={closeModal}>Fermer</button>}

            {modal?.mode === "edit" && editing && (
              <div className="d-flex gap-2 mt-2">
                <button type="button" className="btn btn-outline-secondary flex-grow-1" onClick={() => toggleShare(editing)}>
                  <Icon name={editing.sharedWithViewers ? "eye" : "eye-slash"} className={`me-1 ${editing.sharedWithViewers ? "text-success" : ""}`} size={15} />
                  {editing.sharedWithViewers ? "Partagée" : "Non partagée"}
                </button>
                <button type="button" className="btn btn-outline-danger flex-grow-1" onClick={() => { closeModal(); deleteWithUndo(editing); }}>
                  <Icon name="trash" className="me-1" size={15} />Supprimer
                </button>
              </div>
            )}
          </form>
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Schedule;