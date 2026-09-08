import axios from "axios";

// Le token JWT est stocke en localStorage et attache manuellement a chaque
// requete via le header Authorization (plus fiable que les cookies
// cross-site, qui sont de plus en plus bloques par les navigateurs quand
// frontend et backend sont sur des domaines differents).
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "https://unishare-backend-83eh.onrender.com",
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

api.interceptors.response.use(
    (response) => response,
    (error) => {
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

export default api;