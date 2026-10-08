// src/utils/fileHelpers.js  (nouveau fichier)
// Fonctions partagees pour afficher des fichiers joints.
import api from "../services/api";

export const getExt = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

// Categorie visuelle d'un fichier (badge d'extension colore).
export const getKind = (name, mime = "") => {
  const ext = getExt(name);
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "word";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "excel";
  if (["ppt", "pptx", "odp"].includes(ext)) return "ppt";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (mime.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  if (["txt", "md", "json", "xml"].includes(ext)) return "text";
  return "other";
};

export const formatSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

export const formatDate = (d) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// Repare les noms envoyes avant la correction UTF-8 du backend
// (ex: "ModÃ©lisation" -> "Modélisation"). Sans effet sur les noms normaux.
export const fixName = (s = "") => {
  if (!/[ÃÂ]/.test(s)) return s;
  if ([...s].some((c) => c.charCodeAt(0) > 255)) return s;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  } catch {
    return s;
  }
};

// Reconstruit l'URL d'un fichier avec l'adresse du backend actuel
// (corrige les anciens liens en "http://localhost:5000/..." ou en "http://").
export const resolveFileUrl = (url = "") => {
  try {
    const u = new URL(url);
    if (u.pathname.startsWith("/uploads/") || u.pathname.startsWith("/api/uploads/files/")) {
      const origin = new URL(api.defaults.baseURL || "/", window.location.origin).origin;
      return `${origin}${u.pathname}`;
    }
  } catch {
    /* URL relative ou invalide : on la laisse telle quelle */
  }
  return url;
};
