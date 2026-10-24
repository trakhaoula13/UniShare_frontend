// src/utils/calendarLayout.js  (nouveau fichier)
// Calculs purs du calendrier hebdomadaire (testables sans navigateur).
import { timeToMin } from "./dateHelpers";

// Place les seances d'une meme journee : celles qui se chevauchent sont
// affichees cote a cote. Renvoie [{ item, start, end, lane, lanes }].
export const layoutDay = (items) => {
  const events = items
    .map((item) => ({ item, start: timeToMin(item.startTime), end: Math.max(timeToMin(item.endTime), timeToMin(item.startTime) + 15) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result = [];
  let cluster = [];
  let laneEnds = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const lanes = Math.max(...cluster.map((e) => e.lane)) + 1;
    cluster.forEach((e) => result.push({ ...e, lanes }));
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };

  for (const ev of events) {
    if (cluster.length && ev.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= ev.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(ev.end); } else { laneEnds[lane] = ev.end; }
    clusterEnd = Math.max(clusterEnd, ev.end);
    cluster.push({ ...ev, lane });
  }
  flush();
  return result;
};

// Plage d'heures affichee (au moins 8h-18h, elargie si besoin).
export const hourRange = (items, minStart = 8, minEnd = 18) => {
  let start = minStart;
  let end = minEnd;
  for (const it of items) {
    start = Math.min(start, Math.floor(timeToMin(it.startTime) / 60));
    end = Math.max(end, Math.ceil(timeToMin(it.endTime) / 60));
  }
  return { startHour: Math.max(0, start), endHour: Math.min(24, end) };
};

// Nouvelle heure de debut d'une seance deposee a l'ecran (arrondie a `step` minutes).
export const computeDrop = ({ clientY, columnTop, offsetY, hourPx, startHour, endHour, duration, step = 15 }) => {
  const topPx = clientY - columnTop - offsetY;
  const raw = startHour * 60 + (topPx / hourPx) * 60;
  const snapped = Math.round(raw / step) * step;
  const start = Math.min(Math.max(snapped, startHour * 60), endHour * 60 - duration);
  return { start, end: start + duration };
};
