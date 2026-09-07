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

// Quand plusieurs requetes (ex: Promise.all au chargement du Dashboard)
// echouent en 401 en meme temps -- souvent juste apres un login, le temps
// que le cookie de session soit bien pris en compte -- on ne veut pas
// rediriger sur la premiere reponse venue. On revalide une seule fois via
// /auth/me et on ne redirige que si la session est reellement invalide.
let sessionRecheck = null;

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response ? error.response.status : undefined;
        const isAuthCheck = Boolean(error.config && error.config.url && error.config.url.includes("/auth/me"));
        const onPublicPage = PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));

        if (status === 401 && !isAuthCheck && !onPublicPage) {
            if (!sessionRecheck) {
                sessionRecheck = api
                    .get("/auth/me")
                    .then(() => true)
                    .catch(() => false)
                    .finally(() => { sessionRecheck = null; });
            }
            const stillAuthenticated = await sessionRecheck;
            if (!stillAuthenticated) {
                localStorage.removeItem("user");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default api;