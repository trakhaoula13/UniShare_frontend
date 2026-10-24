import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

// Liste d'une ressource (cours, notes...) avec affichage INSTANTANE :
//  - la derniere liste connue est relue depuis le navigateur et affichee tout de suite,
//  - puis rafraichie en arriere-plan (le serveur peut etre lent a repondre).
// Renvoie { items, setItems, create, update, loading, reload }.

const cacheKey = (endpoint) => {
    let user = {};
    try {
        user = JSON.parse(localStorage.getItem("user")) || {};
    } catch {
        /* ignore */
    }
    const sponsor = (user.sponsor && user.sponsor._id) || user.sponsor || "";
    return `res:${user._id || "anon"}:${sponsor}:${endpoint}`;
};

const readCache = (key) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const writeCache = (key, data) => {
    try {
        const text = JSON.stringify(data);
        if (text.length < 1000000) localStorage.setItem(key, text); // on evite les listes trop lourdes
    } catch {
        /* ignore */
    }
};

// Fusionne la reponse du serveur dans un element, sans ecraser un objet deja
// complet (ex: le cours d'une note) par un simple identifiant.
const mergeKeepPopulated = (oldItem, newItem) => {
    const result = {...oldItem };
    for (const k of Object.keys(newItem)) {
        const oldV = oldItem[k];
        const newV = newItem[k];
        if (
            typeof newV === "string" &&
            oldV &&
            typeof oldV === "object" &&
            !Array.isArray(oldV) &&
            oldV._id === newV
        ) {
            continue;
        }
        result[k] = newV;
    }
    return result;
};

const useResource = (endpoint) => {
    const key = cacheKey(endpoint);
    const [items, setItemsState] = useState(() => readCache(key) || []);
    const [loading, setLoading] = useState(() => readCache(key) === null);
    const mounted = useRef(true);

    const setItems = useCallback(
        (next) => {
            setItemsState((prev) => {
                const value = typeof next === "function" ? next(prev) : next;
                writeCache(key, value);
                return value;
            });
        }, [key]
    );

    const reload = useCallback(async() => {
        try {
            const { data } = await api.get(endpoint);
            if (mounted.current) {
                setItemsState(data);
                writeCache(key, data);
            }
            return data;
        } catch {
            return null;
        } finally {
            if (mounted.current) setLoading(false);
        }
    }, [endpoint, key]);

    useEffect(() => {
        mounted.current = true;
        reload();
        return () => {
            mounted.current = false;
        };
    }, [reload]);

    const create = async(payload) => {
        const { data } = await api.post(endpoint, payload);
        setItems((prev) => [data, ...prev]);
        reload(); // recupere la version complete (cours lie, ordre du serveur...)
        return data;
    };

    const update = async(id, payload) => {
        const { data } = await api.put(`${endpoint}/${id}`, payload);
        setItems((prev) =>
            prev.map((i) => (i._id === id ? mergeKeepPopulated(i, data) : i))
        );
        reload();
        return data;
    };

    return { items, setItems, create, update, loading, reload };
};

export default useResource;