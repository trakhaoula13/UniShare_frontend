import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const NotFound = () => (
  <div className="d-flex flex-column justify-content-center align-items-center vh-100 text-center">
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
      <h1 className="display-1 fw-bold text-primary">404</h1>
      <p className="text-muted mb-4">Cette page n'existe pas.</p>
      <Link to="/dashboard" className="btn btn-primary">Retour au tableau de bord</Link>
    </motion.div>
  </div>
);

export default NotFound;
