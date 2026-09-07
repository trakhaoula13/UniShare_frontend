import React from "react";
import { useNotifications } from "../context/NotificationContext";
import Icon from "./Icon";

const NotificationBell = () => {
  const { notifications } = useNotifications();

  return (
    <div className="dropdown">
      <button className="btn-icon notification-bell-btn" data-bs-toggle="dropdown" aria-label="Notifications">
        <Icon name="bell" />
        {notifications.length > 0 && <span className="notification-badge">{notifications.length}</span>}
      </button>
      <ul className="dropdown-menu dropdown-menu-end notification-dropdown">
        <li><h6 className="dropdown-header">Rappels</h6></li>
        {notifications.length === 0 && (
          <li><span className="dropdown-item-text text-muted small">Aucun rappel pour le moment.</span></li>
        )}
        {notifications.map((n) => (
          <li key={n.id}>
            <div className={`notification-item notification-${n.tone}`}>
              <Icon name={n.icon} size={16} />
              <span>{n.message}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotificationBell;
