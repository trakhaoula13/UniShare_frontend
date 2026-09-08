import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import PasswordInput from "../components/PasswordInput";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter";
import api from "../services/api";
import Icon from "../components/Icon";

const ResetPasswordConfirm = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      navigate("/login", { state: { resetSuccess: true } });
    } catch (err) {
      setError(err.response?.data?.message || "Ce lien est invalide ou a expire");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual d-none d-lg-flex">
        <motion.div className="auth-visual-content" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
          <span className="auth-visual-badge"><Icon name="shield-lock-fill" className="me-1" />Securite du compte</span>
          <Icon name="shield-lock-fill" className="auth-visual-icon" />
          <h1>Nouveau mot de passe</h1>
          <p>Choisissez un mot de passe securise pour votre compte UniBoard.</p>
        </motion.div>
      </div>

      <div className="auth-form-side">
        <motion.form className="auth-card" onSubmit={handleSubmit} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h2 className="fw-bold mb-1"><Icon name="shield-lock" className="me-2" />Reinitialiser le mot de passe</h2>
          <p className="text-muted mb-4">Choisissez votre nouveau mot de passe.</p>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <div className="mb-3">
            <label className="form-label">Nouveau mot de passe</label>
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} name="newPassword" minLength={6} />
            <PasswordStrengthMeter password={newPassword} />
          </div>

          <div className="mb-4">
            <label className="form-label">Confirmer le mot de passe</label>
            <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} name="confirmPassword" minLength={6} />
          </div>

          <button className="btn btn-primary w-100 btn-animated" disabled={loading}>
            {loading ? "Reinitialisation..." : "Reinitialiser le mot de passe"}
          </button>

          <p className="text-center mt-4 mb-0 text-muted">
            <Link to="/login"><Icon name="arrow-left" className="me-1" />Retour a la connexion</Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
};

export default ResetPasswordConfirm;