import React from "react";

// Cartes "squelette" affichees pendant le chargement (a la place d'un ecran vide).
export const CardSkeletons = ({ count = 6, className = "col-md-6 col-xl-4" }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className={className} aria-hidden="true">
        <div className="skeleton-card">
          <div className="skeleton skeleton-line" style={{ width: "35%" }} />
          <div className="skeleton skeleton-line skeleton-title" style={{ width: "75%" }} />
          <div className="skeleton skeleton-line" style={{ width: "95%" }} />
          <div className="skeleton skeleton-line" style={{ width: "60%" }} />
          <div className="skeleton skeleton-bar" />
        </div>
      </div>
    ))}
  </>
);

export const PageLoader = () => (
  <div className="page-loader" role="status" aria-label="Chargement">
    <div className="spinner-border text-primary" />
  </div>
);
