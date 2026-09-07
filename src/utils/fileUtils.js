import api from "../services/api";

// Envoie un fichier PDF au backend (stockage sur disque) et renvoie son
// URL publique + son nom d'origine. Remplace l'ancienne conversion en
// base64 : fichiers plus legers a manipuler, pas de limite de taille JSON.
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/uploads", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data; // { fileUrl, fileName, fileType }
};
