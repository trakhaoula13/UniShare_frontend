import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import api from "../services/api";
import { sendPasswordResetEmail } from "../services/emailService";
import Icon from "../components/Icon";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Le backend genere le resetToken, le frontend construit le lien et
  // l'envoie lui-meme par email via EmailJS.
  const requestResetLink = async () => {
    const { data } = await api.post("/auth/forgot-password", { email });
    const resetLink = `${window.location.origin}/reset-password/${data.resetToken}`;
    await sendPasswordResetEmail({
      email,
      resetLink,
      fullName: `${data.firstName || ""} ${data.lastName || ""}`.trim(),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestResetLink();
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Erreur lors de l'envoi de l'email");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setLoading(true);
    try {
      await requestResetLink();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Erreur lors du renvoi de l'email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual d-none d-lg-flex">
        <motion.div className="auth-visual-content" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
          <span className="auth-visual-badge"><Icon name="shield-lock-fill" className="me-1" />Securite du compte</span>
          <Icon name="key-fill" className="auth-visual-icon" />
          <h1>Mot de passe oublie ?</h1>
          <p>Pas de panique, nous vous envoyons un lien de reinitialisation par email. Ouvrez votre boite mail et cliquez dessus pour choisir un nouveau mot de passe.</p>
        </motion.div>
      </div>

      <div className="auth-form-side">
        <motion.div className="auth-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {!sent ? (
            <form onSubmit={handleSubmit}>
              <h2 className="fw-bold mb-1">Mot de passe oublie</h2>
              <p className="text-muted mb-4">Entrez votre email, vous recevrez un lien pour reinitialiser votre mot de passe.</p>

              {error && <div className="alert alert-danger py-2">{error}</div>}

              <div className="mb-4">
                <label className="form-label">Adresse email</label>
                <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <button className="btn btn-primary w-100 btn-animated" disabled={loading}>
                {loading ? "Envoi..." : "Envoyer le lien de reinitialisation"}
              </button>

              <p className="text-center mt-4 mb-0 text-muted">
                <Link to="/login"><Icon name="arrow-left" className="me-1" />Retour a la connexion</Link>
              </p>
            </form>
          ) : (
            <div className="text-center">
              <Icon name="envelope-check-fill" className="display-4 text-success mb-3 d-block" />
              <h2 className="fw-bold mb-2">Email envoye !</h2>
              <p className="text-muted mb-1">
                Un lien de reinitialisation vient d'etre envoye a <strong>{email}</strong>.
              </p>
              <p className="text-muted mb-4">
                Ouvrez votre boite mail et cliquez sur le bouton dans l'email pour choisir un nouveau mot de passe.
                Le lien expire dans 30 minutes.
              </p>

              {error && <div className="alert alert-danger py-2 text-start">{error}</div>}

              <button className="btn btn-outline-primary w-100 mb-2" onClick={handleResend} disabled={loading}>
                {loading ? "Envoi..." : "Renvoyer l'email"}
              </button>

              <Link to="/login" className="btn btn-link w-100">
                <Icon name="arrow-left" className="me-1" />Retour a la connexion
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;
