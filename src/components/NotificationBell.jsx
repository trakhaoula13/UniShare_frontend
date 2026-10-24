import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import Icon from "./Icon";

const NotificationBell = () => {
  const { notifications, refresh, dismiss, clearAll } = useNotifications();
  const navigate = useNavigate();
  const wrapRef = useRef(null);

  // Données fraîches à chaque ouverture du menu (événement Bootstrap).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onShow = () => refresh();
    el.addEventListener("show.bs.dropdown", onShow);
    return () => el.removeEventListener("show.bs.dropdown", onShow);
  }, [refresh]);

  // stopPropagation : Bootstrap ferme le menu au moindre clic, on veut qu'il reste ouvert.
  const handleDismiss = (e, key) => { e.stopPropagation(); dismiss(key); };
  const handleClearAll = (e) => { e.stopPropagation(); clearAll(); };

  return (
    <div className="dropdown" ref={wrapRef}>
      <button className="btn-icon notification-bell-btn" data-bs-toggle="dropdown" aria-label="Notifications">
        <Icon name="bell" />
        {notifications.length > 0 && <span className="notification-badge">{notifications.length}</span>}
      </button>
      <ul className="dropdown-menu dropdown-menu-end notification-dropdown">
        <li className="notification-head">
          <h6 className="dropdown-header">Rappels</h6>
          {notifications.length > 0 && (
            <button type="button" className="notification-clear-all" onClick={handleClearAll}>Tout effacer</button>
          )}
        </li>
        {notifications.length === 0 && (
          <li><span className="dropdown-item-text text-muted small">Aucun rappel pour le moment.</span></li>
        )}
        {notifications.map((n) => (
          <li key={n.key} className="notification-row">
            <button type="button" className={`dropdown-item notification-item notification-${n.tone}`} onClick={() => navigate(n.to)}>
              <Icon name={n.icon} size={16} />
              <span>
                <span className="notification-text">{n.text}</span>
                {n.sub && <small className="notification-sub">{n.sub}</small>}
              </span>
            </button>
            <button type="button" className="notification-dismiss" onClick={(e) => handleDismiss(e, n.key)} aria-label="Effacer ce rappel" title="Effacer">
              <Icon name="x-lg" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotificationBell;