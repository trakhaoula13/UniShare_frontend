import { daysUntil, dueLabel, timeToMin, toKey } from "./dateHelpers";
import { occursOn } from "./scheduleOccurrence";

const FINISHED = ["done", "past"];
const TONE_ORDER = { danger: 0, warning: 1, info: 2 };
const todoDone = (t) => t.done || t.status === "done";

// Rappels affichés dans la cloche. Mêmes règles que la carte "Rappels" du
// tableau de bord : séances proches, échéances, examens, tâches urgentes.
export const computeReminders = ({ assignments = [], todos = [], schedule = [], now = new Date() }) => {
  const list = [];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Séances d'aujourd'hui (en cours, ou qui commencent dans l'heure)
  schedule.filter((s) => s.startTime && occursOn(s, now)).forEach((s) => {
    const start = timeToMin(s.startTime);
    const end = s.endTime ? timeToMin(s.endTime) : start;
    const where = s.room ? ` · ${s.room}` : "";
    if (nowMin >= start && nowMin < end) {
      list.push({ id: `s-${s._id}`, tone: "info", icon: "calendar-event", text: `${s.subject} : séance en cours`, sub: `Jusqu'à ${s.endTime}${where}`, to: "/schedule" });
    } else if (start > nowMin && start - nowMin <= 60) {
      list.push({ id: `s-${s._id}`, tone: "warning", icon: "calendar-event", text: `${s.subject} dans ${start - nowMin} min`, sub: `${s.startTime}${where}`, to: "/schedule" });
    }
  });

  // Projets tutorés et examens
  assignments.filter((a) => !FINISHED.includes(a.status)).forEach((a) => {
    const d = daysUntil(a.dueDate, now);
    const isExam = a.type === "exam";
    if (d < 0) {
      list.push({ id: `a-${a._id}`, tone: "danger", icon: "exclamation-triangle-fill", text: `${a.title} : ${dueLabel(d).toLowerCase()}`, sub: isExam ? "Examen" : "Projet tutoré", to: "/assignments" });
    } else if (isExam && d <= 2) {
      list.push({ id: `a-${a._id}`, tone: "danger", icon: "mortarboard", text: `Examen ${d === 0 ? "aujourd'hui" : d === 1 ? "demain" : "dans 2 jours"} : ${a.title}`, sub: a.startTime ? `À ${a.startTime}${a.room ? ` · ${a.room}` : ""}` : a.course?.title, to: "/assignments" });
    } else if (!isExam && d <= 3) {
      list.push({ id: `a-${a._id}`, tone: "warning", icon: "clipboard-check", text: `${a.title} : livraison ${d === 0 ? "aujourd'hui" : d === 1 ? "demain" : `dans ${d} jours`}`, sub: `${a.progress || 0}% de progression`, to: "/assignments" });
    }
  });

  // Tâches : en retard / pour aujourd'hui ou demain / urgentes
  const todoItems = [];
  todos.filter((t) => !todoDone(t)).forEach((t) => {
    const d = t.dueDate ? daysUntil(t.dueDate, now) : null;
    if (d !== null && d <= 1) {
      todoItems.push({ id: `t-${t._id}`, tone: d < 0 ? "danger" : "warning", icon: "check2-square", text: `Tâche ${d < 0 ? "en retard" : d === 0 ? "pour aujourd'hui" : "pour demain"} : ${t.text}`, sub: "À faire", to: "/todos" });
    } else if (t.priority === "urgent") {
      todoItems.push({ id: `t-${t._id}`, tone: "warning", icon: "check2-square", text: `Tâche urgente : ${t.text}`, sub: "À faire", to: "/todos" });
    }
  });
  list.push(...todoItems.slice(0, 5));

  // Clé servant à effacer un rappel : une séance est effacée pour la journée ;
  // une échéance ou une tâche réapparaît si son message change (ex. "demain" -> "aujourd'hui").
  const today = toKey(now);
  list.forEach((r) => { r.key = r.id.startsWith("s-") ? `${r.id}@${today}` : `${r.id}@${r.text}`; });

  return list.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]).slice(0, 10);
};
