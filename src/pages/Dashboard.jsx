import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen, Hourglass, CheckCircle2, ListChecks, CalendarClock, Bell, Clock, MapPin, AlertTriangle, Sparkles, ArrowRight, Table2, List as ListIcon, GraduationCap, FolderKanban } from "lucide-react";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import Icon from "../components/Icon";
import Sparkline from "../components/Sparkline";
import AnimatedNumber from "../components/AnimatedNumber";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { DAYS, addDays, daysUntil, dueLabel, dueTone, formatShort, startOfDay, timeToMin, toKey, weekdayIndex } from "../utils/dateHelpers";
import { hasNewContent, syncSeen } from "../utils/newContent";
import { occursOn } from "../utils/scheduleOccurrence";
import { container, item as fadeItem } from "../utils/motion";

const emptyLinkForm = { label: "", url: "", icon: "link-45deg" };
const FINISHED = ["done", "past"];
const isFinished = (a) => FINISHED.includes(a.status);
const statusLabel = (a) =>
  a.type === "exam" ? (isFinished(a) ? "Passé" : "À venir") : a.status === "done" ? "Terminé" : a.status === "in_progress" ? "En cours" : "À faire";
const PRIO = { haute: "prio-haute", moyenne: "prio-moyenne", basse: "prio-basse" };
const TONE_ORDER = { danger: 0, warning: 1, info: 2 };

const Dashboard = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [assignments, setAssignments] = useState([]);
  const [todos, setTodos] = useState([]);
  const [links, setLinks] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [courses, setCourses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(new Date());

  const [tableView, setTableView] = useState("list"); // list | table
  const [typeFilter, setTypeFilter] = useState("all"); // all | assignment | exam

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState(emptyLinkForm);
  const [editingLinkId, setEditingLinkId] = useState(null);

  const loadAll = async () => {
    const safe = (p) => p.catch(() => ({ data: [] }));
    const [a, t, l, s, c, n] = await Promise.all([
      safe(api.get("/assignments")), safe(api.get("/todos")), safe(api.get("/quicklinks")),
      safe(api.get("/schedule")), safe(api.get("/courses")), safe(api.get("/notes")),
    ]);
    setAssignments(a.data); setTodos(t.data); setLinks(l.data); setSchedule(s.data); setCourses(c.data); setNotes(n.data);
    setLoaded(true);
  };

  useEffect(() => { loadAll(); }, []);
  // L'heure se rafraichit chaque minute (cours en cours, rappels).
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);

  /* ---------------- Donnees calculees ---------------- */

  const todayName = DAYS[weekdayIndex(now)];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const courseColor = (subject) => courses.find((c) => c.title === subject)?.color || "#6c63ff";

  const sessionsToday = useMemo(
    () => schedule.filter((s) => occursOn(s, now)).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [schedule, todayName] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const sessionState = (s) => {
    const start = timeToMin(s.startTime);
    const end = timeToMin(s.endTime);
    if (nowMin >= end) return { key: "done", label: "Terminé" };
    if (nowMin >= start) return { key: "live", label: "En cours" };
    const diff = start - nowMin;
    return { key: "next", label: diff < 60 ? `Dans ${diff} min` : `Dans ${Math.floor(diff / 60)}h${String(diff % 60).padStart(2, "0")}` };
  };

  const statusOfTodo = (t) => (t.done || t.status === "done" ? "done" : t.status || "todo");
  const activeTodos = todos.filter((t) => statusOfTodo(t) !== "done");
  const todosToday = useMemo(() => {
    const due = activeTodos.filter((t) => (t.dueDate && daysUntil(t.dueDate, now) <= 0) || ["in_progress", "review"].includes(statusOfTodo(t)));
    const list = due.length ? due : activeTodos.filter((t) => t.priority === "urgent");
    return list.slice(0, 6);
  }, [todos, now]); // eslint-disable-line

  const activeAssignments = assignments.filter((a) => !isFinished(a));
  const deadlines = useMemo(
    () => activeAssignments.map((a) => ({ a, days: daysUntil(a.dueDate, now) })).filter((x) => x.days <= 14).sort((x, y) => x.days - y.days).slice(0, 6),
    [assignments, now] // eslint-disable-line
  );

  // Series des mini-graphiques : 7 derniers jours (activite) ou 7 prochains jours (charge)
  const last7 = Array.from({ length: 7 }, (_, i) => toKey(addDays(startOfDay(now), i - 6)));
  const next7 = Array.from({ length: 7 }, (_, i) => toKey(addDays(startOfDay(now), i)));
  const doneAssignments = assignments.filter(isFinished);
  const doneTodos = todos.filter((t) => statusOfTodo(t) === "done");
  const doneByDay = (list) => last7.map((k) => list.filter((x) => x.updatedAt && toKey(new Date(x.updatedAt)) === k).length);
  const loadByDay = next7.map((k) => activeAssignments.filter((a) => String(a.dueDate).slice(0, 10) === k).length);
  const avgProgress = courses.length ? Math.round(courses.reduce((s, c) => s + (c.progress || 0), 0) / courses.length) : 0;
  const weekDone = doneByDay(doneAssignments).reduce((s, n) => s + n, 0);
  const dueSoon = activeAssignments.filter((a) => daysUntil(a.dueDate, now) <= 7).length;

  const kpis = [
    { key: "courses", icon: BookOpen, label: "Cours actifs", value: courses.length, caption: `${avgProgress}% de progression moyenne`, spark: { type: "bars", values: courses.map((c) => c.progress || 0), max: 100 }, primary: true },
    { key: "pending", icon: Hourglass, label: "En attente", value: activeAssignments.length, caption: `${dueSoon} à rendre sous 7 jours`, spark: { type: "bars", values: loadByDay } },
    { key: "done", icon: CheckCircle2, label: "Terminés", value: doneAssignments.length, caption: `${weekDone} cette semaine`, spark: { type: "line", values: doneByDay(doneAssignments) } },
    { key: "todos", icon: ListChecks, label: "Tâches (total)", value: todos.length, caption: `${doneTodos.length} terminée${doneTodos.length > 1 ? "s" : ""}`, spark: { type: "line", values: doneByDay(doneTodos) } },
  ];

  // Rappels calcules a partir des donnees (cours, echeances, taches, nouveau contenu)
  const reminders = useMemo(() => {
    const list = [];
    sessionsToday.forEach((s) => {
      const st = sessionState(s);
      if (st.key === "live") list.push({ id: `s-${s._id}`, tone: "info", icon: Clock, text: `${s.subject} : séance en cours`, sub: `Jusqu'à ${s.endTime}${s.room ? ` · ${s.room}` : ""}`, to: "/schedule" });
      else if (st.key === "next" && timeToMin(s.startTime) - nowMin <= 60) list.push({ id: `s-${s._id}`, tone: "warning", icon: Clock, text: `${s.subject} à ${s.startTime}`, sub: `${st.label}${s.room ? ` · ${s.room}` : ""}`, to: "/schedule" });
    });
    activeAssignments.forEach((a) => {
      const d = daysUntil(a.dueDate, now);
      const isExam = a.type === "exam";
      if (d < 0) list.push({ id: `a-${a._id}`, tone: "danger", icon: AlertTriangle, text: `${a.title} : ${dueLabel(d).toLowerCase()}`, sub: isExam ? "Examen" : "Projet tutoré", to: "/assignments" });
      else if (isExam && d <= 2) list.push({ id: `a-${a._id}`, tone: "danger", icon: GraduationCap, text: `Examen ${d === 0 ? "aujourd'hui" : d === 1 ? "demain" : "dans 2 jours"} : ${a.title}`, sub: a.startTime ? `À ${a.startTime}${a.room ? ` · ${a.room}` : ""}` : a.course?.title, to: "/assignments" });
      else if (!isExam && d <= 3) list.push({ id: `a-${a._id}`, tone: "warning", icon: FolderKanban, text: `${a.title} : livraison ${d === 0 ? "aujourd'hui" : d === 1 ? "demain" : `dans ${d} jours`}`, sub: `${a.progress || 0}% de progression`, to: "/assignments" });
    });
    todos.filter((t) => statusOfTodo(t) !== "done" && t.priority === "urgent").slice(0, 2).forEach((t) =>
      list.push({ id: `t-${t._id}`, tone: "warning", icon: ListChecks, text: `Tâche urgente : ${t.text}`, sub: "À faire", to: "/todos" })
    );
    const seen = syncSeen(notes);
    notes.filter((n) => hasNewContent(n, seen)).slice(0, 2).forEach((n) =>
      list.push({ id: `n-${n._id}`, tone: "info", icon: Sparkles, text: `Nouveau contenu : ${n.title}`, sub: n.course?.title, to: `/notes/${n._id}` })
    );
    return list.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, 6);
  }, [sessionsToday, assignments, todos, notes, now]); // eslint-disable-line

  // Jauge de progression globale
  const gaugeTotal = assignments.length;
  const gaugeDone = doneAssignments.length;
  const gaugeProgress = assignments.filter((a) => !isFinished(a) && (a.status === "in_progress")).length;
  const gaugePct = gaugeTotal ? Math.round((gaugeDone / gaugeTotal) * 100) : 0;

  // Liste / tableau des projets tutores et examens
  const tableRows = useMemo(() => {
    const rows = assignments.filter((a) => typeFilter === "all" || (typeFilter === "exam" ? a.type === "exam" : a.type !== "exam"));
    return [...rows].sort((a, b) => Number(isFinished(a)) - Number(isFinished(b)) || new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 8);
  }, [assignments, typeFilter]);

  /* ---------------- Actions ---------------- */

  const toggleTodo = async (t) => {
    const next = statusOfTodo(t) === "done" ? "todo" : "done";
    setTodos((list) => list.map((x) => (x._id === t._id ? { ...x, status: next, done: next === "done" } : x)));
    try { await api.put(`/todos/${t._id}`, { status: next }); } catch { loadAll(); }
  };

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
    showToast(editingLinkId ? "Lien mis à jour" : "Lien ajouté", { type: "success" });
    loadAll();
  };

  const handleLinkDelete = async (link) => {
    const ok = await confirm(`Supprimer le lien "${link.label}" ?`);
    if (!ok) return;
    await api.delete(`/quicklinks/${link._id}`);
    showToast("Lien supprimé", { type: "info" });
    loadAll();
  };

  const dueBadge = (a) => {
    if (isFinished(a)) return <span className="due-badge due-muted">{formatShort(a.dueDate)}</span>;
    const d = daysUntil(a.dueDate, now);
    return <span className={`due-badge due-${dueTone(d)}`}>{dueLabel(d)}</span>;
  };

  /* ---------------- Rendu ---------------- */

  return (
    <Layout title={<>Bonjour, {user?.name?.split(" ")[0]} <Icon name="stars" className="text-warning" /></>}>
      <PageWrapper>
        <motion.div variants={container} initial="hidden" animate="show">
          {/* ----- KPI ----- */}
          <div className="row g-3 mb-3">
            {kpis.map((k) => (
              <motion.div key={k.key} className="col-6 col-xl-3" variants={fadeItem}>
                <div className={`kpi-card ${k.primary ? "kpi-primary" : ""}`}>
                  <div className="kpi-top">
                    <span className="kpi-icon"><k.icon size={18} className="app-icon" /></span>
                    <span className="kpi-label">{k.label}</span>
                  </div>
                  <div className="kpi-value"><AnimatedNumber value={loaded ? k.value : 0} /></div>
                  <div className="kpi-bottom">
                    <small className="kpi-caption">{k.caption}</small>
                    <Sparkline type={k.spark.type} values={k.spark.values} max={k.spark.max} width={86} height={30} color={k.primary ? "#ffffff" : "#6c63ff"} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ----- Aujourd'hui ----- */}
          <div className="row g-3 mb-3">
            <motion.div className="col-lg-4" variants={fadeItem}>
              <div className="panel-card h-100 widget">
                <div className="widget-head">
                  <h5><CalendarClock size={18} className="app-icon me-2" />Cours du jour</h5>
                  <span className="widget-sub">{todayName}</span>
                </div>
                {sessionsToday.length === 0 && <p className="text-muted mb-0">{loaded ? "Pas de cours aujourd'hui." : "Chargement..."}</p>}
                <ul className="list-unstyled mb-0">
                  {sessionsToday.map((s) => {
                    const st = sessionState(s);
                    return (
                      <li key={s._id} className={`day-session day-session-${st.key}`} style={{ "--ev-color": courseColor(s.subject) }}>
                        <div className="day-session-time">{s.startTime}<small>{s.endTime}</small></div>
                        <div className="flex-grow-1 min-w-0">
                          <strong className="d-block text-truncate">{s.subject}</strong>
                          <small className="text-muted">{s.type}{s.room ? <> · <MapPin size={11} className="app-icon" /> {s.room}</> : ""}</small>
                        </div>
                        <span className={`state-pill state-${st.key}`}>{st.label}</span>
                      </li>
                    );
                  })}
                </ul>
                <Link to="/schedule" className="widget-link">Emploi du temps <ArrowRight size={14} className="app-icon" /></Link>
              </div>
            </motion.div>

            <motion.div className="col-lg-4" variants={fadeItem}>
              <div className="panel-card h-100 widget">
                <div className="widget-head">
                  <h5><ListChecks size={18} className="app-icon me-2" />Tâches à faire aujourd'hui</h5>
                </div>
                {todosToday.length === 0 && <p className="text-muted mb-0">{loaded ? "Rien d'urgent pour aujourd'hui." : "Chargement..."}</p>}
                <ul className="list-unstyled mb-0">
                  <AnimatePresence initial={false}>
                    {todosToday.map((t) => {
                      const d = t.dueDate ? daysUntil(t.dueDate, now) : null;
                      return (
                        <motion.li key={t._id} className="todo-row" layout exit={{ opacity: 0, x: 20 }}>
                          <button className="btn-icon btn-icon-sm" onClick={() => toggleTodo(t)} aria-label="Marquer comme terminée"><Icon name="square" /></button>
                          <span className="flex-grow-1 text-truncate">{t.text}</span>
                          {d !== null && <span className={`due-badge due-${dueTone(d)}`}>{dueLabel(d)}</span>}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
                <Link to="/todos" className="widget-link">Toutes les tâches <ArrowRight size={14} className="app-icon" /></Link>
              </div>
            </motion.div>

            <motion.div className="col-lg-4" variants={fadeItem}>
              <div className="panel-card h-100 widget">
                <div className="widget-head">
                  <h5><Bell size={18} className="app-icon me-2" />Rappels</h5>
                  {reminders.length > 0 && <span className="kb-count">{reminders.length}</span>}
                </div>
                {reminders.length === 0 && <p className="text-muted mb-0">{loaded ? "Tout est à jour, aucun rappel." : "Chargement..."}</p>}
                <ul className="list-unstyled mb-0">
                  {reminders.map((r) => (
                    <li key={r.id}>
                      <Link to={r.to} className={`reminder reminder-${r.tone}`}>
                        <span className="reminder-icon"><r.icon size={15} className="app-icon" /></span>
                        <span className="min-w-0">
                          <strong className="d-block text-truncate">{r.text}</strong>
                          {r.sub && <small className="text-muted d-block text-truncate">{r.sub}</small>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>

          {/* ----- Echeances + progression ----- */}
          <div className="row g-3 mb-3">
            <motion.div className="col-lg-5" variants={fadeItem}>
              <div className="panel-card h-100 widget">
                <div className="widget-head">
                  <h5><Hourglass size={18} className="app-icon me-2" />Deadlines proches</h5>
                  <span className="widget-sub">14 jours</span>
                </div>
                {deadlines.length === 0 && <p className="text-muted mb-0">{loaded ? "Aucune échéance dans les 14 jours." : "Chargement..."}</p>}
                <ul className="list-unstyled mb-0">
                  {deadlines.map(({ a, days }) => (
                    <li key={a._id} className="assignment-row">
                      <span className={`type-dot ${a.type === "exam" ? "dot-exam" : "dot-assignment"}`}></span>
                      <div className="flex-grow-1 min-w-0">
                        <strong className="d-block text-truncate">{a.title}</strong>
                        <small className="text-muted">{a.type === "exam" ? "Examen" : "Projet tutoré"}{a.course?.title ? ` · ${a.course.title}` : ""}</small>
                      </div>
                      <span className={`due-badge due-${dueTone(days)}`}>{dueLabel(days)}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/assignments" className="widget-link">Projets & examens <ArrowRight size={14} className="app-icon" /></Link>
              </div>
            </motion.div>

            <motion.div className="col-lg-4" variants={fadeItem}>
              <div className="panel-card h-100 widget text-center">
                <div className="widget-head"><h5>Progression globale</h5></div>
                <div className="gauge">
                  <svg viewBox="0 0 170 100" aria-hidden="true">
                    <path d="M 15 85 A 70 70 0 0 1 155 85" className="gauge-track" pathLength="1" />
                    <motion.path d="M 15 85 A 70 70 0 0 1 155 85" className="gauge-fill" pathLength="1" initial={{ pathLength: 0 }} animate={{ pathLength: gaugePct / 100 }} transition={{ duration: 1, ease: "easeOut" }} />
                  </svg>
                  <div className="gauge-value"><AnimatedNumber value={gaugePct} />%</div>
                </div>
                <small className="text-muted">des projets et examens terminés</small>
                <div className="gauge-legend">
                  <span><i style={{ background: "#22c55e" }} />Terminés <b>{gaugeDone}</b></span>
                  <span><i style={{ background: "#6c63ff" }} />En cours <b>{gaugeProgress}</b></span>
                  <span><i style={{ background: "#f59e0b" }} />À faire <b>{Math.max(0, gaugeTotal - gaugeDone - gaugeProgress)}</b></span>
                </div>
              </div>
            </motion.div>

            <motion.div className="col-lg-3" variants={fadeItem}>
              <div className="panel-card h-100 widget">
                <div className="widget-head"><h5>Raccourcis</h5></div>
                <div className="shortcut-grid">
                  <Link to="/assignments" className="shortcut"><FolderKanban size={18} className="app-icon" />Projets</Link>
                  <Link to="/assignments" className="shortcut"><GraduationCap size={18} className="app-icon" />Examens</Link>
                  <Link to="/courses" className="shortcut"><BookOpen size={18} className="app-icon" />Cours</Link>
                  <Link to="/schedule" className="shortcut"><CalendarClock size={18} className="app-icon" />Emploi du temps</Link>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ----- Projets tutores & examens : liste / tableau ----- */}
          <motion.div variants={fadeItem} className="mb-3">
            <div className="panel-card widget">
              <div className="widget-head flex-wrap gap-2">
                <h5><FolderKanban size={18} className="app-icon me-2" />Projets tutorés & examens</h5>
                <div className="d-flex gap-2 flex-wrap">
                  <div className="seg-control seg-small">
                    {[["all", "Tout"], ["assignment", "Projets"], ["exam", "Examens"]].map(([k, l]) => (
                      <button key={k} className={typeFilter === k ? "active" : ""} onClick={() => setTypeFilter(k)}>{l}</button>
                    ))}
                  </div>
                  <div className="seg-control seg-small">
                    <button className={tableView === "list" ? "active" : ""} onClick={() => setTableView("list")} aria-label="Vue liste"><ListIcon size={15} className="app-icon me-1" />Liste</button>
                    <button className={tableView === "table" ? "active" : ""} onClick={() => setTableView("table")} aria-label="Vue tableau"><Table2 size={15} className="app-icon me-1" />Tableau</button>
                  </div>
                </div>
              </div>

              {tableRows.length === 0 && <p className="text-muted mb-0">{loaded ? "Rien de prévu pour le moment." : "Chargement..."}</p>}

              {tableView === "list" && (
                <ul className="list-unstyled mb-0">
                  {tableRows.map((a) => (
                    <li key={a._id} className={`assignment-row ${isFinished(a) ? "row-finished" : ""}`}>
                      <span className={`type-dot ${a.type === "exam" ? "dot-exam" : "dot-assignment"}`}></span>
                      <div className="flex-grow-1 min-w-0">
                        <strong className={`d-block text-truncate ${isFinished(a) ? "text-decoration-line-through text-muted" : ""}`}>{a.title}</strong>
                        <small className="text-muted">{a.course?.title || "Sans cours"} · {statusLabel(a)}</small>
                      </div>
                      {dueBadge(a)}
                    </li>
                  ))}
                </ul>
              )}

              {tableView === "table" && tableRows.length > 0 && (
                <div className="table-responsive">
                  <table className="table align-middle mb-0 dash-table">
                    <thead><tr><th>Type</th><th>Titre</th><th>Cours</th><th>Échéance</th><th>Statut</th><th>Progression</th></tr></thead>
                    <tbody>
                      {tableRows.map((a) => (
                        <tr key={a._id} className={isFinished(a) ? "row-finished" : ""}>
                          <td><span className={`type-badge ${a.type === "exam" ? "badge-exam" : "badge-assignment"}`}>{a.type === "exam" ? "Examen" : "Projet"}</span></td>
                          <td className="fw-semibold">{a.title}</td>
                          <td className="text-muted">{a.course?.title || "—"}</td>
                          <td>{dueBadge(a)}</td>
                          <td>{statusLabel(a)}</td>
                          <td style={{ minWidth: 120 }}>
                            {a.type === "exam"
                              ? (a.grade !== null && a.grade !== undefined ? <span className={`grade-badge ${a.grade >= 10 ? "grade-ok" : "grade-low"}`}>{a.grade}/20</span> : <span className="text-muted">—</span>)
                              : <span className="list-progress"><span style={{ width: `${a.progress || 0}%` }} /></span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Link to="/assignments" className="widget-link">Voir tout <ArrowRight size={14} className="app-icon" /></Link>
            </div>
          </motion.div>

          {/* ----- Liens rapides ----- */}
          <motion.div variants={fadeItem}>
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
                    <motion.div key={link._id} className="quicklink-chip" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -2 }}>
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
        </motion.div>

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
              <label className="form-label">Icône</label>
              <input className="form-control" placeholder="Ex: mortarboard, book, globe..." value={linkForm.icon} onChange={(e) => setLinkForm({ ...linkForm, icon: e.target.value })} />
              <small className="text-muted">Nom d'icône (ex: book, globe, search, mortarboard)</small>
            </div>
            <button className="btn btn-primary w-100 btn-animated">{editingLinkId ? "Enregistrer" : "Ajouter"}</button>
          </form>
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Dashboard;