import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import StatCard from "../components/StatCard";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Icon from "../components/Icon";

const ROLE_LABELS = { user: "Etudiant", admin: "Administrateur", viewonly: "Lecture seule" };

const ACTION_LABELS = {
  role_change: "Changement de role",
  code_created: "Code d'acces genere",
  code_revoked: "Code d'acces revoque",
  code_redeemed: "Code d'acces utilise",
};

const Admin = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [codes, setCodes] = useState([]);
  const [logs, setLogs] = useState([]);
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const load = async () => {
    const [sRes, uRes, cRes, lRes, rRes] = await Promise.all([
      api.get("/stats/admin"),
      api.get("/users"),
      api.get("/access-codes?all=true"),
      api.get("/users/audit-log"),
      api.get("/upgrade-requests"),
    ]);
    setStats(sRes.data);
    setUsers(uRes.data);
    setCodes(cRes.data);
    setLogs(lRes.data);
    setUpgradeRequests(rRes.data);
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (id, role) => {
    const { data } = await api.put(`/users/${id}/role`, { role });
    setUsers((prev) => prev.map((u) => (u._id === id ? data : u)));
    showToast("Role mis a jour", { type: "success" });
    api.get("/users/audit-log").then(({ data }) => setLogs(data));
  };

  const removeUser = async (targetUser) => {
    const ok = await confirm(`Supprimer definitivement le compte de "${targetUser.name}" ?`);
    if (!ok) return;
    await api.delete(`/users/${targetUser._id}`);
    setUsers((prev) => prev.filter((u) => u._id !== targetUser._id));
    showToast("Utilisateur supprime", { type: "info" });
  };

  const revokeCode = async (codeDoc) => {
    const ok = await confirm(`Revoquer le code "${codeDoc.code}" ?`);
    if (!ok) return;
    await api.delete(`/access-codes/${codeDoc._id}`);
    setCodes((prev) => prev.map((c) => (c._id === codeDoc._id ? { ...c, revoked: true } : c)));
    showToast("Code revoque", { type: "info" });
  };

  const resolveUpgrade = async (request, action) => {
    if (action === "approve") {
      const ok = await confirm(`Passer le compte de "${request.user?.name}" en Etudiant ?`);
      if (!ok) return;
    }
    try {
      const { data } = await api.put(`/upgrade-requests/${request._id}`, { action });
      setUpgradeRequests((prev) => prev.map((r) => (r._id === data._id ? data : r)));
      if (action === "approve") {
        setUsers((prev) => prev.map((u) => (u._id === request.user?._id ? { ...u, role: "user", sponsor: null } : u)));
      }
      showToast(action === "approve" ? "Demande approuvee" : "Demande refusee", { type: action === "approve" ? "success" : "info" });
      api.get("/users/audit-log").then(({ data }) => setLogs(data));
    } catch (err) {
      showToast(err.response?.data?.message || "Impossible de traiter la demande", { type: "danger" });
    }
  };

  const pendingUpgradeCount = upgradeRequests.filter((r) => r.status === "pending").length;

  return (
    <Layout title="Administration">
      <PageWrapper>
        <div className="row g-3 mb-4">
          <StatCard icon="people" label="Utilisateurs" value={stats?.usersCount ?? "-"} color="primary" delay={0} />
          <StatCard icon="shield-check" label="Administrateurs" value={stats?.adminsCount ?? "-"} color="success" delay={0.05} />
          <StatCard icon="book" label="Cours crees" value={stats?.coursesCount ?? "-"} color="info" delay={0.1} />
          <StatCard icon="clipboard-check" label="Elements crees" value={stats?.assignmentsCount ?? "-"} color="warning" delay={0.15} />
        </div>

        <motion.div className="panel-card mb-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="panel-header">
            <h5><Icon name="people" className="me-2" />Gestion des utilisateurs</h5>
          </div>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr><th>Nom</th><th>Email</th><th>Role</th><th>Sponsor (lecteur)</th><th>Inscrit le</th><th></th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <span className="avatar-circle small-avatar me-2">{u.name.charAt(0).toUpperCase()}</span>
                      {u.name} {u._id === currentUser?._id && <span className="badge bg-light text-dark ms-1">Vous</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="form-select form-select-sm role-select"
                        value={u.role}
                        onChange={(e) => changeRole(u._id, e.target.value)}
                        disabled={u._id === currentUser?._id}
                        aria-label={`Role de ${u.name}`}
                      >
                        <option value="viewonly">Lecture seule</option>
                        <option value="user">Etudiant</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </td>
                    <td className="text-muted small">{u.sponsor ? u.sponsor.name : "—"}</td>
                    <td className="text-muted small">{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td>
                      <button className="btn-icon text-danger" disabled={u._id === currentUser?._id} onClick={() => removeUser(u)} aria-label={`Supprimer ${u.name}`}>
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div className="panel-card mb-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <div className="panel-header d-flex align-items-center justify-content-between">
            <h5 className="mb-0">
              <Icon name="arrow-up-circle" className="me-2" />Demandes de mise a niveau
              {pendingUpgradeCount > 0 && <span className="badge bg-warning text-dark ms-2">{pendingUpgradeCount} en attente</span>}
            </h5>
          </div>
          {upgradeRequests.length === 0 && <p className="text-muted small mb-0">Aucune demande pour le moment.</p>}
          <div className="access-code-list">
            {upgradeRequests.map((r) => (
              <div key={r._id} className="access-code-row" style={{ alignItems: "flex-start" }}>
                <div className="access-code-meta">
                  <div>
                    <strong>{r.user?.name}</strong>{" "}
                    <span className="text-muted small">({r.user?.email})</span>
                  </div>
                  {r.message && <div className="text-muted small mt-1">"{r.message}"</div>}
                  <div className="text-muted small mt-1">
                    Demande le {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                    {r.status !== "pending" && r.resolvedBy && ` — traitee par ${r.resolvedBy.name}`}
                  </div>
                </div>
                {r.status === "pending" ? (
                  <div className="d-flex gap-1">
                    <button className="btn btn-sm btn-outline-success" onClick={() => resolveUpgrade(r, "approve")}>
                      <Icon name="check-lg" className="me-1" />Approuver
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => resolveUpgrade(r, "reject")}>
                      <Icon name="x-lg" className="me-1" />Refuser
                    </button>
                  </div>
                ) : (
                  <span className={`badge ${r.status === "approved" ? "bg-success" : "bg-secondary"}`}>
                    {r.status === "approved" ? "Approuvee" : "Refusee"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="row g-3">
          <motion.div className="col-lg-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <div className="panel-card h-100">
              <div className="panel-header">
                <h5><Icon name="key-fill" className="me-2" />Codes d'acces (tous)</h5>
              </div>
              {codes.length === 0 && <p className="text-muted small mb-0">Aucun code genere.</p>}
              <div className="access-code-list">
                {codes.map((c) => (
                  <div key={c._id} className={`access-code-row ${c.revoked ? "access-code-revoked" : ""}`}>
                    <code>{c.code}</code>
                    <div className="access-code-meta">
                      <div className="small text-muted">Par {c.createdBy?.name}</div>
                      {c.activeUsers?.length > 0 && (
                        <div className="small text-success">
                          {c.activeUsers.length === 1
                            ? `Utilise par ${c.activeUsers[0].name}`
                            : `Utilise par ${c.activeUsers.length} lecteurs`}
                        </div>
                      )}
                    </div>
                    {!c.revoked && (
                      <button className="btn-icon text-danger" onClick={() => revokeCode(c)} aria-label="Revoquer"><Icon name="trash" size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div className="col-lg-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="panel-card h-100">
              <div className="panel-header">
                <h5><Icon name="clock" className="me-2" />Journal des modifications</h5>
              </div>
              {logs.length === 0 && <p className="text-muted small mb-0">Aucune activite pour le moment.</p>}
              <ul className="audit-log-list">
                {logs.map((log) => (
                  <li key={log._id} className="audit-log-item">
                    <div className="d-flex justify-content-between">
                      <strong className="small">{ACTION_LABELS[log.action] || log.action}</strong>
                      <span className="text-muted small">{new Date(log.createdAt).toLocaleString("fr-FR")}</span>
                    </div>
                    <p className="text-muted small mb-0">
                      {log.actor?.name} — {log.message}
                      {log.target ? ` (${log.target.name})` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </PageWrapper>
    </Layout>
  );
};

export default Admin;