// src/utils/newContent.js  (nouveau fichier)
// Badge "Nouveau contenu" : on retient, dans ce navigateur, le nombre de
// fichiers + notes internes deja vus pour chaque note. S'il augmente
// (ajout depuis un autre appareil, ou par le sponsor), la note est marquee.
const KEY = "seenContent";

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
};
const write = (map) => {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* ignore */ }
};

// Nombre d'elements de contenu d'une note (ancien PDF unique inclus).
export const contentCount = (note) => {
  const files = note.files || [];
  const legacy = note.fileUrl && !files.some((f) => f.fileUrl === note.fileUrl) ? 1 : 0;
  return files.length + legacy + (note.entries || []).length;
};

// A la toute premiere utilisation, on memorise l'existant (aucun badge d'un coup).
export const syncSeen = (notes) => {
  let seen = read();
  if (!seen) {
    if (!notes.length) return null; // rien de charge : on ne memorise pas un etat vide
    seen = {};
    notes.forEach((n) => { seen[n._id] = contentCount(n); });
    write(seen);
  }
  return seen;
};

export const markSeen = (note) => {
  const seen = read() || {};
  seen[note._id] = contentCount(note);
  write(seen);
};

export const hasNewContent = (note, seen) => {
  if (!seen) return false;
  const count = contentCount(note);
  if (count === 0) return false;
  return note._id in seen ? count > seen[note._id] : true; // note creee depuis : nouvelle
};
