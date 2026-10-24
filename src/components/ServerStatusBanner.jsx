import React, { useEffect, useRef, useState } from "react";

// Petit bandeau affiche quand le serveur met du temps a repondre.
const ServerStatusBanner = () => {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    const onSlow = (e) => {
      clearTimeout(hideTimer.current);
      if (e.detail) setVisible(true);
      else hideTimer.current = setTimeout(() => setVisible(false), 900); // evite le clignotement
    };
    window.addEventListener("api-slow", onSlow);
    return () => { window.removeEventListener("api-slow", onSlow); clearTimeout(hideTimer.current); };
  }, []);

  if (!visible) return null;
  return (
    <div className="server-banner" role="status" aria-live="polite">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      <span>Le serveur démarre… cela peut prendre jusqu'à une minute après une période d'inactivité.</span>
    </div>
  );
};

export default ServerStatusBanner;
