import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import Icon from "./Icon";

const links = [
  { to: "/dashboard", icon: "speedometer2", label: "Tableau de bord", denyRoles: ["viewonly"] },
  { to: "/courses", icon: "book", label: "Cours" },
  { to: "/assignments", icon: "clipboard-check", label: "Projets Tutorés & Examens" },
  { to: "/notes", icon: "journal-text", label: "Notes" },
  { to: "/research", icon: "search", label: "Recherche", denyRoles: ["viewonly"] },
  { to: "/schedule", icon: "calendar3", label: "Emploi du temps" },
  { to: "/todos", icon: "check2-square", label: "To-Do List", denyRoles: ["viewonly"] },
  { to: "/access-codes", icon: "key-fill", label: "Codes d'acces" },
];

const Sidebar = ({ mobileOpen = false, onClose = () => {} }) => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const visibleLinks = links.filter((link) => !link.denyRoles?.includes(user?.role));
  const isConsulting = user?.role === "user" && !!user?.sponsor;

  const quickLeave = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/access-codes/leave");
      const updated = { ...user, ...data.user };
      setUser(updated);
      localStorage.setItem("user", JSON.stringify(updated));
      navigate("/dashboard");
    } catch {
      // silencieux : le lecteur "Codes d'acces" reste disponible en repli
    }
  };

  return (
    <motion.aside
      className={"app-sidebar d-flex flex-column" + (mobileOpen ? " mobile-open" : "")}
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="sidebar-brand">
        <Icon name="mortarboard-fill" />
        <span>UniShare</span>
      </div>

      {user?.role === "viewonly" && (
        <div className="sidebar-viewonly-badge">
          <Icon name="eye" size={13} className="me-1" />Lecture seule
        </div>
      )}

      {isConsulting && (
        <div className="sidebar-viewonly-badge d-flex align-items-center justify-content-between gap-2">
          <span className="text-truncate">
            <Icon name="eye" size={13} className="me-1" />Consultation : {user.sponsor?.name}
          </span>
          <button className="btn-icon" onClick={quickLeave} title="Quitter et revenir a mon compte" aria-label="Quitter et revenir a mon compte">
            <Icon name="box-arrow-right" size={14} />
          </button>
        </div>
      )}

      <nav className="sidebar-nav flex-grow-1">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onClose}
            className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
          >
            <Icon name={link.icon} size={17} />
            <span>{link.label}</span>
          </NavLink>
        ))}

        {user?.role === "admin" && (
          <NavLink to="/admin" onClick={onClose} className={({ isActive }) => "sidebar-link admin-link" + (isActive ? " active" : "")}>
            <Icon name="shield-lock" />
            <span>Administration</span>
          </NavLink>
        )}
      </nav>

      <NavLink to="/profile" onClick={onClose} className="sidebar-link">
        <Icon name="person-circle" />
        <span>Profil</span>
      </NavLink>
    </motion.aside>
  );
};

export default Sidebar;