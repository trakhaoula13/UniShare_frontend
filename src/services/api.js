import axios from "axios";
import { RETRY_DELAYS, shouldRetry } from "../utils/http";

// Le token JWT est stocke en localStorage et attache manuellement a chaque
// requete via le header Authorization (plus fiable que les cookies
// cross-site, qui sont de plus en plus bloques par les navigateurs quand
// frontend et backend sont sur des domaines differents).
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "https://unishare-backend-83eh.onrender.com",
    timeout: 30000, // chaque essai est limite a 30 s
});

/* ---------- Etat "le serveur est lent / se reveille" ---------- */
// Quand une requete dure plus de 4 s, ou qu'on est en train de reessayer,
// on previent l'interface (bandeau ServerStatusBanner).
let pending = 0;
let retrying = 0;
let slowFired = false;
let slowTimer = null;
let shown = false;

const refresh = () => {
    const show = retrying > 0 || (pending > 0 && slowFired);
    if (show !== shown) {
        shown = show;
        window.dispatchEvent(new CustomEvent("api-slow", { detail: show }));
    }
};
const begin = () => {
    pending += 1;
    if (!slowTimer) {
        slowTimer = setTimeout(() => {
            slowFired = true;
            refresh();
        }, 4000);
    }
};
const end = () => {
    pending = Math.max(0, pending - 1);
    if (pending === 0) {
        clearTimeout(slowTimer);
        slowTimer = null;
        slowFired = false;
    }
    refresh();
};

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    begin();
    return config;
});

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.response.use(
    (response) => {
        end();
        return response;
    },
    async(error) => {
        end();

        // Serveur endormi ou injoignable : on reessaie automatiquement.
        if (shouldRetry(error)) {
            const config = error.config;
            config.__retryCount = (config.__retryCount || 0) + 1;
            retrying += 1;
            refresh();
            await sleep(RETRY_DELAYS[Math.min(config.__retryCount - 1, RETRY_DELAYS.length - 1)]);
            retrying = Math.max(0, retrying - 1);
            return api(config);
        }

        const status = error.response ? error.response.status : undefined;
        const isAuthCheck = Boolean(error.config && error.config.url && error.config.url.includes("/auth/me"));
        const onPublicPage = PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));

        if (status === 401 && !isAuthCheck && !onPublicPage) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

// Reveille le serveur des l'ouverture du site (avant meme que tu te connectes).
export const wakeServer = () => api.get("/health").catch(() => {});

export default api;