// src/utils/dateHelpers.js  (nouveau fichier)
// Petites fonctions de dates partagees par le calendrier, les projets/examens,
// la to-do et le tableau de bord.

export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

export const pad = (n) => String(n).padStart(2, "0");

// Cle "AAAA-MM-JJ" d'une date locale.
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Cle "AAAA-MM-JJ" d'une date venant de l'API (chaine ISO ou Date) :
// on lit les 10 premiers caracteres pour eviter tout decalage de fuseau.
export const isoKey = (value) => (typeof value === "string" ? value.slice(0, 10) : toKey(new Date(value)));

// Date locale (minuit) a partir d'une cle ou d'une valeur d'API.
export const fromKey = (value) => {
  const [y, m, d] = isoKey(value).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const isSameDay = (a, b) => toKey(a) === toKey(b);

// 0 = lundi ... 6 = dimanche
export const weekdayIndex = (d) => (d.getDay() + 6) % 7;
export const startOfWeek = (d) => addDays(startOfDay(d), -weekdayIndex(d));

export const timeToMin = (t) => {
  const [h, m] = String(t || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

// Nombre de jours entre aujourd'hui et une date d'echeance (negatif = en retard).
export const daysUntil = (value, now = new Date()) =>
  Math.round((fromKey(value) - startOfDay(now)) / 86400000);

export const dueLabel = (days) =>
  days < 0 ? `En retard (${-days} j)` : days === 0 ? "Aujourd'hui" : days === 1 ? "Demain" : `J-${days}`;

// Couleur du badge d'echeance : danger | warning | info | muted
export const dueTone = (days) => (days < 0 ? "danger" : days <= 2 ? "warning" : days <= 7 ? "info" : "muted");

export const formatShort = (value) =>
  fromKey(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export const formatLong = (value) =>
  fromKey(value).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

// Date + heure ("HH:MM") d'un examen.
export const withTime = (value, time) => {
  const d = fromKey(value);
  const m = timeToMin(time);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};
