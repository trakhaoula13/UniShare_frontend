import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// Calcule les rappels a afficher a partir des devoirs/examens et de
// l'emploi du temps deja charges -- aucun etat "lu/non lu" persiste,
// la liste est simplement recalculee a chaque rafraichissement.
const computeReminders = (assignments, schedule) => {
  const now = new Date();
  const reminders = [];

  assignments.forEach((a) => {
    if (a.status === "done") return;
    const due = new Date(a.dueDate);
    const hoursLeft = (due - now) / 3600000;
    if (hoursLeft > 0 && hoursLeft <= 24) {
      reminders.push({
        id: `assignment-${a._id}`,
        icon: a.type === "exam" ? "exclamation-triangle-fill" : "clipboard-check",
        tone: "warning",
        message: `${a.type === "exam" ? "Examen" : "Projet tutore"} "${a.title}" demain (${due.toLocaleDateString("fr-FR")})`,
        time: due,
      });
    }
  });

  const todayName = DAY_NAMES[now.getDay()];
  schedule.forEach((s) => {
    if (s.day !== todayName || !s.startTime) return;
    const [h, m] = s.startTime.split(":").map(Number);
    const sessionDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    const minutesLeft = (sessionDate - now) / 60000;
    if (minutesLeft > 0 && minutesLeft <= 60) {
      reminders.push({
        id: `schedule-${s._id}`,
        icon: "calendar-event",
        tone: "info",
        message: `Seance "${s.subject}" dans ${Math.round(minutesLeft)} min (${s.startTime}${s.room ? ", salle " + s.room : ""})`,
        time: sessionDate,
      });
    }
  });

  return reminders.sort((a, b) => a.time - b.time);
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      const [assignRes, scheduleRes] = await Promise.all([api.get("/assignments"), api.get("/schedule")]);
      setNotifications(computeReminders(assignRes.data, scheduleRes.data));
    } catch {
      // Les notifications ne doivent jamais faire planter le reste de l'app.
    }
  }, [user]);

  useEffect(() => {
    refresh();
    // Rafraichit chaque minute : assez frequent pour un compte a rebours
    // en minutes, assez espace pour rester leger.
    const interval = setInterval(refresh, 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{ notifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
