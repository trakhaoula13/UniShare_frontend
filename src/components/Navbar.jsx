import React from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";
import NotificationBell from "./NotificationBell";

const ROLE_BADGES = {
  admin: { label: "Administrateur", icon: "shield-check", className: "badge-admin" },
  viewonly: { label: "Lecture seule", icon: "eye", className: "badge-viewonly" },
  user: { label: "Etudiant", icon: "person", className: "badge-user" },
};

const Topbar = ({ title, onToggleMenu = () => {} }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="app-topbar d-flex justify-content-between align-items-center">
      <div className="d-flex align-items-center gap-2">
        <button className="btn-icon d-lg-none menu-toggle-btn" onClick={onToggleMenu} aria-label="Ouvrir le menu">
          <Icon name="list" size={24} />
        </button>
        <div>
          <h4 className="mb-0 fw-bold">{title}</h4>
          <p className="text-muted mb-0 small">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <div className="d-flex align-items-center gap-3">
        <NotificationBell />
        <button
          className="btn-icon theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Activer le mode sombre" : "Activer le mode clair"}
          title={theme === "light" ? "Mode sombre" : "Mode clair"}
        >
          <Icon name={theme === "light" ? "moon-stars" : "sun"} />
        </button>
        <span className={`badge role-badge ${(ROLE_BADGES[user?.role] || ROLE_BADGES.user).className}`}>
          <Icon name={(ROLE_BADGES[user?.role] || ROLE_BADGES.user).icon} size={14} />{" "}
          {(ROLE_BADGES[user?.role] || ROLE_BADGES.user).label}
        </span>
        <div className="dropdown">
          <button
            className="btn user-chip dropdown-toggle"
            type="button"
            data-bs-toggle="dropdown"
            aria-label="Menu du compte"
          >
            <span className="avatar-circle">{user?.name?.charAt(0).toUpperCase()}</span>
            <span className="d-none d-md-inline">{user?.name}</span>
          </button>
          <ul className="dropdown-menu dropdown-menu-end">
            <li>
              <button className="dropdown-item" onClick={() => navigate("/profile")}>
                <Icon name="person" className="me-2" />Mon profil
              </button>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item text-danger" onClick={handleLogout}>
                <Icon name="box-arrow-right" className="me-2" />Deconnexion
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
