import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// denyRoles : liste de roles qui n'ont pas acces a cette page (ex: un
// compte "viewonly" n'a pas acces au Dashboard, a la Recherche, aux Taches
// ou a la gestion des liens rapides -- hors de son perimetre de lecture).
const ProtectedRoute = ({ children, adminOnly = false, denyRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  if (denyRoles.includes(user.role)) return <Navigate to="/courses" replace />;

  return children;
};

export default ProtectedRoute;
