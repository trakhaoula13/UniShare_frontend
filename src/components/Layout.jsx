import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Navbar";

const Layout = ({ title, children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}
      <div className="app-main">
        <Topbar title={title} onToggleMenu={() => setMobileOpen((v) => !v)} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
