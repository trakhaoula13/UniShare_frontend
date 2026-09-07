import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Icon from "../components/Icon";

// Page dediee aux codes d'acces :
// - Etudiant : generer/gerer ses propres codes, ET entrer un code pour
//   consulter temporairement les elements partages d'un sponsor (il garde
//   son propre compte et y revient simplement en quittant).
// - Administrateur : generer et gerer ses codes.
// - Lecture seule : entrer un code pour se rattacher a un sponsor, en
//   changer a tout moment, ou quitter le sponsor actuel.
const AccessCodes = () => {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const isViewOnly = user?.role === "viewonly";
  const canGenerate = user?.role === "user" || user?.role === "admin";
  const canConsult = user?.role === "user" || user?.role === "viewonly";

  const [codes, setCodes] = useState([]);
  const [expiresInDays, setExpiresInDays] = useState("");
  const [loadingCodes, setLoadingCodes] = useState(canGenerate);

  const [redeemCode, setRedeemCode] = useState("");
  const [redeemError, setRedeemError] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const [upgradeRequest, setUpgradeRequest] = useState(null);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [loadingUpgrade, setLoadingUpgrade] = useState(isViewOnly);

  useEffect(() => {
    if (canGenerate) {
      api.get("/access-codes").then(({ data }) => setCodes(data)).catch(() => {}).finally(() => setLoadingCodes(false));
    }
    if (isViewOnly) {
      api.get("/upgrade-requests/me").then(({ data }) => setUpgradeRequest(data)).catch(() => {}).finally(() => setLoadingUpgrade(false));
    }
    // eslint-disable-next-line
  }, []);

  const persistUser = (updated) => {
    setUser(updated);
    localStorage.setItem("user", JSON.stringify(updated));
  };

  const generateCode = async () => {
    const payload = expiresInDays ? { expiresInDays: Number(expiresInDays) } : {};
    const { data } = await api.post("/access-codes", payload);
    setCodes((prev) => [data, ...prev]);
    setExpiresInDays("");
    showToast(`Code ${data.code} genere`, { type: "success" });
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code);
    showToast("Code copie dans le presse-papiers", { type: "info" });
  };

  const revokeCode = async (codeDoc) => {
    const ok = await confirm(`Revoquer le code "${codeDoc.code}" ? Il ne pourra plus etre utilise.`);
    if (!ok) return;
    await api.delete(`/access-codes/${codeDoc._id}`);
    setCodes((prev) => prev.map((c) => (c._id === codeDoc._id ? { ...c, revoked: true } : c)));
    showToast("Code revoque", { type: "info" });
  };

  const handleRedeem = async (e) => {
    e.preventDefault();
    setRedeemError("");
    if (user?.sponsor) {
      const ok = await confirm(
        `Vous consultez actuellement les elements de "${user.sponsor.name}". Entrer un nouveau code remplacera ce lien. Continuer ?`
      );
      if (!ok) return;
    }

    setRedeemLoading(true);
    try {
      const { data } = await api.post("/access-codes/redeem", { code: redeemCode });
      persistUser({ ...user, ...data.user });
      setRedeemCode("");
      showToast("Vous consultez maintenant les elements de ce sponsor", { type: "success" });
    } catch (err) {
      setRedeemError(err.response?.data?.message || "Code invalide");
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleLeave = async () => {
    const ok = await confirm("Quitter ce sponsor ? Vous ne verrez plus aucun element jusqu'a l'entree d'un nouveau code.");
    if (!ok) return;
    setLeaveLoading(true);
    try {
      const { data } = await api.post("/access-codes/leave");
      persistUser({ ...user, ...data.user });
      showToast("Vous avez quitte ce sponsor", { type: "info" });
    } catch (err) {
      showToast(err.response?.data?.message || "Impossible de quitter ce sponsor", { type: "danger" });
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleUpgradeRequest = async (e) => {
    e.preventDefault();
    setUpgradeLoading(true);
    try {
      const { data } = await api.post("/upgrade-requests", { message: upgradeMessage });
      setUpgradeRequest(data);
      setUpgradeMessage("");
      showToast("Demande envoyee a l'administration", { type: "success" });
    } catch (err) {
      showToast(err.response?.data?.message || "Impossible d'envoyer la demande", { type: "danger" });
    } finally {
      setUpgradeLoading(false);
    }
  };

  return (
    <Layout title="Codes d'acces">
      <PageWrapper>
        {canConsult && (
          <motion.div className="panel-card mb-3" style={{ maxWidth: 560 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="panel-header">
              <h5><Icon name="unlock" className="me-2" />{isViewOnly ? "Entrer un code de lecteur" : "Consulter les elements d'un sponsor"}</h5>
            </div>

            <div className="alert alert-info d-flex align-items-center gap-2 mb-3">
              <Icon name="eye" />
              {user?.sponsor
                ? <>Vous consultez actuellement les elements partages par <strong>{user.sponsor.name}</strong> ({user.sponsor.email}).</>
                : "Vous n'etes rattache a aucun sponsor pour le moment : entrez un code pour commencer a consulter des elements."}
            </div>

            <p className="text-muted small">
              Si quelqu'un vous a partage un code, entrez-le ci-dessous pour consulter ses cours,
              devoirs/examens, notes et emploi du temps <strong>marques comme partages</strong>.
              {isViewOnly
                ? " Vous pouvez changer de sponsor a tout moment en entrant un nouveau code."
                : " Votre propre compte n'est pas modifie : vous retrouvez vos propres elements des que vous quittez."}
            </p>

            <form className="d-flex gap-2" onSubmit={handleRedeem}>
              <input
                className="form-control text-uppercase"
                placeholder="Ex: 3F9A2B7C"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                required
              />
              <button className="btn btn-primary btn-animated" disabled={redeemLoading}>
                {redeemLoading ? "..." : "Valider"}
              </button>
            </form>
            {redeemError && <div className="alert alert-danger py-2 mt-2 mb-0">{redeemError}</div>}

            {user?.sponsor && (
              <button className="btn btn-outline-danger mt-3" onClick={handleLeave} disabled={leaveLoading}>
                <Icon name="box-arrow-right" className="me-1" />
                {leaveLoading ? "..." : isViewOnly ? "Quitter ce sponsor" : "Quitter et revenir a mon compte"}
              </button>
            )}
          </motion.div>
        )}

        {isViewOnly && (
          <motion.div className="panel-card mb-3" style={{ maxWidth: 560 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="panel-header">
              <h5><Icon name="arrow-up-circle" className="me-2" />Demander un compte complet</h5>
            </div>
            <p className="text-muted small">
              Vous pouvez demander a un administrateur de passer votre compte de
              "Lecture seule" a "Etudiant" (avec droits d'ecriture). L'administration
              approuve ou refuse la demande depuis la page Administration.
            </p>

            {loadingUpgrade && <p className="text-muted small mb-0">Chargement...</p>}

            {!loadingUpgrade && upgradeRequest?.status === "pending" && (
              <div className="alert alert-warning d-flex align-items-center gap-2 mb-0">
                <Icon name="hourglass-split" />
                Votre demande est en attente de validation par un administrateur.
              </div>
            )}

            {!loadingUpgrade && upgradeRequest?.status === "approved" && (
              <div className="alert alert-success d-flex align-items-center gap-2 mb-0">
                <Icon name="check-circle-fill" />
                Votre demande a ete approuvee ! Reconnectez-vous pour retrouver un compte complet.
              </div>
            )}

            {!loadingUpgrade && (!upgradeRequest || upgradeRequest.status === "rejected") && (
              <>
                {upgradeRequest?.status === "rejected" && (
                  <div className="alert alert-danger py-2 mb-3">
                    Votre precedente demande a ete refusee. Vous pouvez en soumettre une nouvelle.
                  </div>
                )}
                <form onSubmit={handleUpgradeRequest}>
                  <textarea
                    className="form-control mb-2"
                    rows={2}
                    placeholder="Un message pour l'administrateur (optionnel)"
                    value={upgradeMessage}
                    onChange={(e) => setUpgradeMessage(e.target.value)}
                    maxLength={300}
                  />
                  <button className="btn btn-outline-primary" disabled={upgradeLoading}>
                    <Icon name="send" className="me-1" />
                    {upgradeLoading ? "..." : "Envoyer la demande"}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        )}

        {canGenerate && (
          <motion.div className="panel-card" style={{ maxWidth: 560 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="panel-header">
              <h5><Icon name="key-fill" className="me-2" />Codes d'acces (lecteurs)</h5>
            </div>
            <p className="text-muted small">
              Generez un code pour donner a quelqu'un un acces en lecture seule a vos cours,
              devoirs/examens, notes et emploi du temps <strong>marques comme partages</strong>.
              Un meme code peut etre utilise par plusieurs lecteurs en meme temps, et reutilise
              autant de fois que necessaire tant qu'il n'est pas revoque ou expire.
            </p>

            <div className="d-flex gap-2 mb-3">
              <input
                type="number" min="1" className="form-control" style={{ maxWidth: 200 }}
                placeholder="Expiration (jours, optionnel)"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
              <button type="button" className="btn btn-outline-primary" onClick={generateCode}>
                <Icon name="plus-lg" className="me-1" />Generer un code
              </button>
            </div>

            {loadingCodes && <p className="text-muted small mb-0">Chargement...</p>}
            {!loadingCodes && codes.length === 0 && <p className="text-muted small mb-0">Aucun code genere pour le moment.</p>}
            <div className="access-code-list">
              {codes.map((c) => (
                <div key={c._id} className={`access-code-row ${c.revoked ? "access-code-revoked" : ""}`}>
                  <code>{c.code}</code>
                  <div className="access-code-meta">
                    {c.activeUsers?.length > 0 ? (
                      <span className="text-success small">
                        <Icon name="check-circle-fill" size={12} className="me-1" />
                        {c.activeUsers.length === 1
                          ? `Utilise par ${c.activeUsers[0].name}`
                          : `Utilise par ${c.activeUsers.length} lecteurs`}
                      </span>
                    ) : c.revoked ? (
                      <span className="text-danger small">Revoque</span>
                    ) : c.expiresAt ? (
                      <span className="text-muted small">Expire le {new Date(c.expiresAt).toLocaleDateString("fr-FR")}</span>
                    ) : (
                      <span className="text-muted small">Sans expiration — pas encore utilise</span>
                    )}
                  </div>
                  <div className="d-flex gap-1">
                    <button className="btn-icon" onClick={() => copyCode(c.code)} aria-label="Copier le code"><Icon name="save" size={14} /></button>
                    {!c.revoked && (
                      <button className="btn-icon text-danger" onClick={() => revokeCode(c)} aria-label="Revoquer le code"><Icon name="trash" size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </PageWrapper>
    </Layout>
  );
};

export default AccessCodes;