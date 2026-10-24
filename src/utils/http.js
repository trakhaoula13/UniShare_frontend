// src/utils/http.js  (nouveau fichier)
// Regles de nouvel essai et messages d'erreur reseau (hebergement gratuit qui s'endort).

// Message lisible : celui du serveur s'il y en a un, sinon une explication claire.
export const apiError = (err, fallback = "Une erreur est survenue") => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (!err?.response) return "Serveur injoignable : il démarre peut-être (hébergement gratuit). Réessayez dans quelques secondes.";
  return fallback;
};

// Attentes entre deux essais (millisecondes) : environ 40 s au total, de quoi
// laisser Render se reveiller.
export const RETRY_DELAYS = [2000, 3000, 4000, 6000, 8000, 10000, 12000];

export const maxRetries = (method) => (String(method || "get").toLowerCase() === "get" ? 6 : 4);

// Faut-il reessayer ? Oui si le serveur n'a pas repondu (endormi, reseau) ou
// s'il renvoie 502/503/504 (passerelle). Pour les ecritures (POST/PUT/DELETE),
// on ne reessaie que si la requete n'a tres probablement pas ete traitee.
export const shouldRetry = (error) => {
  const config = error?.config;
  if (!config || error.code === "ERR_CANCELED") return false;
  const method = String(config.method || "get").toLowerCase();
  const attempts = config.__retryCount || 0;
  if (attempts >= maxRetries(method)) return false;

  const status = error.response?.status;
  const noResponse = !error.response;
  if (method === "get") return noResponse || [502, 503, 504].includes(status);
  return noResponse || [502, 503].includes(status);
};
