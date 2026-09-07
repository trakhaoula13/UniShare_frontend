import axios from "axios";

// L'authentification passe desormais par un cookie httpOnly pose par le
// backend : plus besoin de lire/ecrire un token, ni d'intercepteur pour
// l'injecter dans chaque requete. "withCredentials" suffit a faire envoyer
// le cookie automatiquement par le navigateur a chaque appel.
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "https://unishare-backend-83eh.onrender.com",
    withCredentials: true,
});

// Pages accessibles sans etre connecte : un 401 dessus est normal (on n'est
// justement pas encore authentifie) et ne doit jamais forcer une redirection.
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response ? error.response.status : undefined;
        const isAuthCheck = Boolean(error.config && error.config.url && error.config.url.includes("/auth/me"));
        const onPublicPage = PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));

        if (status === 401 && !isAuthCheck && !onPublicPage) {
            localStorage.removeItem("user");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default api;