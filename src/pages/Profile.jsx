import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const ROLE_INFO = {
  admin: { label: "Administrateur", icon: "shield-check", badgeClass: "badge-admin" },
  user: { label: "Etudiant", icon: "mortarboard", badgeClass: "badge-user" },
  viewonly: { label: "Lecture seule", icon: "eye", badgeClass: "badge-viewonly" },
};

const Profile = () => {
  const { user, setUser } = useAuth();
  const isViewOnly = user?.role === "viewonly";

  const [form, setForm] = useState({ name: user?.name || "", major: user?.major || "" });
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!isViewOnly) {
      api.get("/stats/me").then(({ data }) => setStats(data)).catch(() => {});
    }
    // eslint-disable-next-line
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data } = await api.put("/users/profile", form);
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem("user", JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long" })
    : "—";

  const roleInfo = ROLE_INFO[user?.role] || ROLE_INFO.user;

  return (
    <Layout title="Mon profil">
      <PageWrapper>
        <motion.div
          className="profile-hero"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="profile-hero-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
          <div className="profile-hero-info">
            <h3 className="mb-1">{user?.name}</h3>
            <p className="mb-2 profile-hero-email"><Icon name="envelope" className="me-2" />{user?.email}</p>
            <span className={`badge role-badge ${roleInfo.badgeClass}`}>
              <Icon name={roleInfo.icon} className="me-1" size={14} />
              {roleInfo.label}
            </span>
          </div>
        </motion.div>

        {isViewOnly && (
          <motion.div className="alert alert-info mt-3 d-flex align-items-center justify-content-between flex-wrap gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="d-flex align-items-center gap-2">
              <Icon name="eye" />
              {user?.sponsor
                ? <>Vous consultez les elements partages par <strong>{user.sponsor.name}</strong> ({user.sponsor.email}).</>
                : "Vous n'etes rattache a aucun sponsor pour le moment."}
            </span>
            <Link to="/access-codes" className="btn btn-sm btn-outline-primary">
              <Icon name="key-fill" className="me-1" />{user?.sponsor ? "Changer de code" : "Entrer un code"}
            </Link>
          </motion.div>
        )}

        {!isViewOnly && user?.sponsor && (
          <motion.div className="alert alert-info mt-3 d-flex align-items-center justify-content-between flex-wrap gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="d-flex align-items-center gap-2">
              <Icon name="eye" />
              Vous consultez actuellement les elements partages par <strong>{user.sponsor.name}</strong> ({user.sponsor.email}).
              Votre propre compte n'est pas modifie.
            </span>
            <Link to="/access-codes" className="btn btn-sm btn-outline-primary">
              <Icon name="box-arrow-right" className="me-1" />Quitter
            </Link>
          </motion.div>
        )}

        {!isViewOnly && (
          <div className="row g-3 mt-1">
            <motion.div className="col-md-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="profile-mini-stat">
                <Icon name="book" />
                <div>
                  <h4>{stats?.coursesCount ?? "-"}</h4>
                  <p>Cours actifs</p>
                </div>
              </div>
            </motion.div>
            <motion.div className="col-md-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="profile-mini-stat">
                <Icon name="check2-square" />
                <div>
                  <h4>{stats?.todosDone ?? "-"}/{stats?.todosCount ?? "-"}</h4>
                  <p>Taches terminees</p>
                </div>
              </div>
            </motion.div>
            <motion.div className="col-md-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="profile-mini-stat">
                <Icon name="calendar-heart" />
                <div>
                  <h4 className="text-capitalize">{memberSince}</h4>
                  <p>Membre depuis</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {!isViewOnly && (
          <motion.div
            className="panel-card mt-3"
            style={{ maxWidth: 560 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="panel-header">
              <h5><Icon name="person-gear" className="me-2" />Informations personnelles</h5>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Adresse email</label>
                <div className="input-group">
                  <span className="input-group-text bg-light"><Icon name="envelope" /></span>
                  <input className="form-control" value={user?.email || ""} disabled readOnly />
                </div>
                <small className="text-muted">L'email ne peut pas etre modifie.</small>
              </div>

              <div className="mb-3">
                <label className="form-label">Nom complet</label>
                <div className="input-group">
                  <span className="input-group-text bg-light"><Icon name="person" /></span>
                  <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label">Filiere / Specialite</label>
                <div className="input-group">
                  <span className="input-group-text bg-light"><Icon name="mortarboard" /></span>
                  <input className="form-control" placeholder="Ex: Informatique" value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} />
                </div>
              </div>

              {saved && (
                <motion.div
                  className="alert alert-success py-2 d-flex align-items-center gap-2"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Icon name="check-circle-fill" />Profil mis a jour avec succes !
                </motion.div>
              )}

              <button className="btn btn-primary btn-animated">
                <Icon name="save" className="me-1" />Enregistrer les modifications
              </button>
            </form>
          </motion.div>
        )}

        {!isViewOnly && (
          <motion.div
            className="panel-card mt-3"
            style={{ maxWidth: 560 }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="panel-header">
              <h5><Icon name="key-fill" className="me-2" />Codes d'acces (lecteurs)</h5>
            </div>
            <p className="text-muted small mb-3">
              Generez des codes pour donner a quelqu'un un acces en lecture seule a vos elements
              partages, et suivez leur utilisation.
            </p>
            <Link to="/access-codes" className="btn btn-outline-primary">
              <Icon name="arrow-up-right-circle" className="me-1" />Gerer mes codes d'acces
            </Link>
          </motion.div>
        )}
      </PageWrapper>
    </Layout>
  );
};

export default Profile;