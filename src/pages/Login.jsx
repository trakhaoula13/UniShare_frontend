import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import Icon from "../components/Icon";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const resetSuccess = location.state?.resetSuccess;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual d-none d-lg-flex">
        <motion.div
          className="auth-visual-content"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="auth-visual-badge"><Icon name="mortarboard-fill" className="me-1" />Espace universitaire</span>
          <Icon name="mortarboard-fill" className="auth-visual-icon" />
          <h1>University Dashboard</h1>
          <p>Gerez vos cours, devoirs, notes et emploi du temps depuis un seul espace, pense pour les etudiants et les administrateurs.</p>
        </motion.div>
      </div>

      <div className="auth-form-side">
        <motion.form
          className="auth-card"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="fw-bold mb-1">Bon retour !</h2>
          <p className="text-muted mb-4">Connectez-vous a votre espace universitaire</p>

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {resetSuccess && <div className="alert alert-success py-2">Mot de passe reinitialise ! Vous pouvez vous connecter.</div>}

          <div className="mb-3">
            <label className="form-label">Adresse email</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="mb-2">
            <label className="form-label">Mot de passe</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="text-end mb-4">
            <Link to="/forgot-password" className="small">Mot de passe oublie ?</Link>
          </div>

          <button className="btn btn-primary w-100 btn-animated" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <p className="text-center mt-4 mb-0 text-muted">
            Pas encore de compte ? <Link to="/register">Creer un compte</Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
};

export default Login;
