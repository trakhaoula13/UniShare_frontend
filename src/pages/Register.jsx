import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PasswordInput from "../components/PasswordInput";
import api from "../services/api";
import { sendVerificationEmail } from "../services/emailService";
import Icon from "../components/Icon";

const emptyForm = { name: "", email: "", password: "", major: "" };

const Register = () => {
  const [step, setStep] = useState(1); // 1 = formulaire, 2 = code OTP
  const [form, setForm] = useState(emptyForm);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Etape 1 : le backend genere le code, le frontend l'envoie par email via EmailJS.
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/otp/request", { email: form.email, purpose: "register" });
      await sendVerificationEmail({
        email: form.email,
        code: data.code,
        fullName: form.name,
        expiryTime: `${data.expiresInMinutes} minutes`,
      });
      showToast(`Code envoye a ${form.email}`, { type: "success" });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Erreur lors de l'envoi du code");
    } finally {
      setLoading(false);
    }
  };

  // Etape 2 : verification du code puis creation du compte
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data: verifyData } = await api.post("/otp/verify", {
        email: form.email,
        code: otp,
        purpose: "register",
      });
      await register({ ...form, otpToken: verifyData.otpToken });
      showToast("Bienvenue sur UniBoard !", { type: "success" });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Code invalide ou expire");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/otp/request", { email: form.email, purpose: "register" });
      await sendVerificationEmail({
        email: form.email,
        code: data.code,
        fullName: form.name,
        expiryTime: `${data.expiresInMinutes} minutes`,
      });
      showToast("Nouveau code envoye", { type: "success" });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Erreur lors du renvoi du code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual d-none d-lg-flex">
        <motion.div className="auth-visual-content" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
          <span className="auth-visual-badge"><Icon name="mortarboard-fill" className="me-1" />Espace universitaire</span>
          <Icon name="mortarboard-fill" className="auth-visual-icon" />
          <h1>Rejoignez UniBoard</h1>
          <p>Le premier compte cree devient automatiquement administrateur de la plateforme.</p>
          <p>Les comptes suivants demarrent en lecture seule : une fois connecte, entrez un code d'acces pour consulter les elements partages par quelqu'un.</p>
        </motion.div>
      </div>

      <div className="auth-form-side">
        {step === 1 ? (
          <motion.form className="auth-card" onSubmit={handleRequestOtp} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h2 className="fw-bold mb-1">Creer un compte</h2>
            <p className="text-muted mb-4">Rejoignez votre tableau de bord universitaire</p>

            {error && <div className="alert alert-danger py-2">{error}</div>}

            <div className="mb-3">
              <label className="form-label">Nom complet</label>
              <input name="name" className="form-control" value={form.name} onChange={handleChange} required />
            </div>

            <div className="mb-3">
              <label className="form-label">Adresse email</label>
              <input type="email" name="email" className="form-control" value={form.email} onChange={handleChange} required />
            </div>

            <div className="mb-3">
              <label className="form-label">Filiere / Specialite</label>
              <input name="major" className="form-control" value={form.major} onChange={handleChange} placeholder="Ex: Informatique" />
            </div>

            <div className="alert alert-info py-2 small mb-4 d-flex align-items-center gap-2">
              <Icon name="eye" />
              Votre compte sera cree en lecture seule. Une fois connecte, vous pourrez entrer un
              code d'acces pour consulter les elements partages avec vous.
            </div>

            <div className="mb-4">
              <label className="form-label">Mot de passe</label>
              <PasswordInput value={form.password} onChange={handleChange} name="password" minLength={6} />
            </div>

            <button className="btn btn-primary w-100 btn-animated" disabled={loading}>
              {loading ? "Envoi du code..." : "Recevoir un code de verification"}
            </button>

            <p className="text-center mt-4 mb-0 text-muted">
              Deja un compte ? <Link to="/login">Se connecter</Link>
            </p>
          </motion.form>
        ) : (
          <motion.form className="auth-card" onSubmit={handleVerifyAndRegister} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={() => setStep(1)}>
              <Icon name="arrow-left" className="me-1" />Retour
            </button>

            <h2 className="fw-bold mb-1"><Icon name="shield-check" className="me-2" />Verification email</h2>
            <p className="text-muted mb-4">
              Entrez le code a 6 chiffres envoye a <strong>{form.email}</strong>
            </p>

            {error && <div className="alert alert-danger py-2">{error}</div>}

            <div className="mb-4">
              <label className="form-label">Code de verification</label>
              <input
                className="form-control otp-input"
                inputMode="numeric"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
              />
              <p className="otp-hint mt-1 mb-0">Le code expire au bout de quelques minutes.</p>
            </div>

            <button className="btn btn-primary w-100 btn-animated" disabled={loading || otp.length !== 6}>
              {loading ? "Verification..." : "Verifier & creer mon compte"}
            </button>

            <button type="button" className="btn btn-link w-100 mt-2" onClick={handleResend} disabled={loading}>
              Renvoyer le code
            </button>
          </motion.form>
        )}
      </div>
    </div>
  );
};

export default Register;
