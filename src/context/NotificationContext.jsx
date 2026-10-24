import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import { computeReminders } from "../utils/reminders";

const NotificationContext = createContext({ notifications: [], refresh: () => {}, dismiss: () => {}, clearAll: () => {} });

const asList = (res) => (Array.isArray(res?.data) ? res.data : []);
const MAX_DISMISSED = 200;

const storageKey = (user) => `unishare:dismissed-reminders:${user?._id || user?.id || "anon"}`;
const loadDismissed = (user) => {
  try { return JSON.parse(localStorage.getItem(storageKey(user))) || []; } catch { return []; }
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [all, setAll] = useState([]);
  const [dismissed, setDismissed] = useState([]);

  // Rappels effacés : mémorisés par utilisateur, ils restent effacés après un rechargement.
  useEffect(() => { setDismissed(user ? loadDismissed(user) : []); }, [user]);

  const saveDismissed = useCallback((keys) => {
    const trimmed = keys.slice(-MAX_DISMISSED);
    setDismissed(trimmed);
    try { localStorage.setItem(storageKey(user), JSON.stringify(trimmed)); } catch { /* stockage indisponible */ }
  }, [user]);

  // Aucun état "lu/non lu" côté serveur : la liste est recalculée à chaque rafraîchissement.
  const refresh = useCallback(async () => {
    if (!user) {
      setAll([]);
      return;
    }
    // Chaque source est indépendante : si l'une échoue, les autres s'affichent quand même.
    const safe = (p) => p.catch(() => ({ data: [] }));
    const [a, t, s] = await Promise.all([safe(api.get("/assignments")), safe(api.get("/todos")), safe(api.get("/schedule"))]);
    setAll(computeReminders({ assignments: asList(a), todos: asList(t), schedule: asList(s), now: new Date() }));
  }, [user]);

  useEffect(() => {
    refresh();
    // Toutes les minutes (compte à rebours des séances) + à chaque ouverture de la cloche.
    const interval = setInterval(refresh, 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const notifications = useMemo(() => all.filter((n) => !dismissed.includes(n.key)), [all, dismissed]);

  const dismiss = useCallback((key) => saveDismissed([...dismissed.filter((k) => k !== key), key]), [dismissed, saveDismissed]);
  const clearAll = useCallback(() => saveDismissed([...new Set([...dismissed, ...all.map((n) => n.key)])]), [dismissed, all, saveDismissed]);

  return <NotificationContext.Provider value={{ notifications, refresh, dismiss, clearAll }}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => useContext(NotificationContext);