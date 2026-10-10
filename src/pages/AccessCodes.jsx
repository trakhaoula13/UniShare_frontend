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

  // Choix de ce que le code donne a voir
  const [options, setOptions] = useState({ courses: [], notes: [] });
  const [mode, setMode] = useState("all"); // "all" = tout ce qui est partage, "custom" = choix precis
  const [selCourses, setSelCourses] = useState([]);
  const [selNotes, setSelNotes] = useState([]);
  const [includeContent, setIncludeContent] = useState(true); // toutes les notes/fichiers des cours coches
  const [includeUnshared, setIncludeUnshared] = useState(true); // meme ce qui n'est pas partage
  const [editingCodeId, setEditingCodeId] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

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
      api.get("/access-codes/options").then(({ data }) => setOptions(data)).catch(() => {});
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

  const toggleId = (list, setList, id) =>
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const notesByCourse = options.notes.reduce((acc, n) => {
    const key = n.course?._id || n.course;
    (acc[key] = acc[key] || []).push(n);
    return acc;
  }, {});

  const selectAllNotes = (courseNotes) => {
    const ids = courseNotes.map((n) => n._id);
    const allSelected = ids.every((id) => selNotes.includes(id));
    setSelNotes(allSelected ? selNotes.filter((id) => !ids.includes(id)) : [...new Set([...selNotes, ...ids])]);
  };

  const resetForm = () => {
    setMode("all");
    setSelCourses([]);
    setSelNotes([]);
    setIncludeContent(true);
    setIncludeUnshared(true);
    setExpiresInDays("");
    setEditingCodeId(null);
    setFormError("");
  };

  const startEdit = (codeDoc) => {
    setEditingCodeId(codeDoc._id);
    setMode(codeDoc.restricted ? "custom" : "all");
    setSelCourses((codeDoc.courses || []).map((c) => c._id || c));
    setSelNotes((codeDoc.notes || []).map((n) => n._id || n));
    setIncludeContent(!!codeDoc.includeCourseContent);
    setIncludeUnshared(!!codeDoc.includeUnshared);
    setFormError("");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const submitCode = async () => {
    setFormError("");
    if (mode === "custom" && selCourses.length === 0 && selNotes.length === 0) {
      setFormError("Cochez au moins un cours ou une note.");
      return;
    }
    const payload = {
      restricted: mode === "custom",
      courseIds: selCourses,
      noteIds: selNotes,
      includeCourseContent: includeContent,
      includeUnshared,
    };
    setSaving(true);
    try {
      if (editingCodeId) {
        const { data } = await api.put(`/access-codes/${editingCodeId}`, payload);
        setCodes((prev) => prev.map((c) => (c._id === editingCodeId ? { ...c, ...data, activeUsers: c.activeUsers } : c)));
        showToast("Acces du code modifie", { type: "success" });
      } else {
        if (expiresInDays) payload.expiresInDays = Number(expiresInDays);
        const { data } = await api.post("/access-codes", payload);
        setCodes((prev) => [data, ...prev]);
        showToast(`Code ${data.code} genere`, { type: "success" });
      }
      resetForm();
    } catch (err) {
      setFormError(err.response?.data?.message || "Impossible d'enregistrer ce code");
    } finally {
      setSaving(false);
    }
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
          <motion.div className="panel-card" style={{ maxWidth: 720 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="panel-header">
              <h5><Icon name="key-fill" className="me-2" />Codes d'acces (lecteurs)</h5>
            </div>
            <p className="text-muted small">
              Generez un code pour donner a quelqu'un un acces en lecture seule a vos cours,
              devoirs/examens, notes et emploi du temps <strong>marques comme partages</strong>.
              Un meme code peut etre utilise par plusieurs lecteurs en meme temps, et reutilise
              autant de fois que necessaire tant qu'il n'est pas revoque ou expire.
            </p>

            <div className="scope-form mb-3">
              <h6 className="fw-bold mb-2">
                {editingCodeId ? "Modifier ce que le code donne a voir" : "Nouveau code : que doit-il donner a voir ?"}
              </h6>

              <label className="scope-mode">
                <input type="radio" className="form-check-input" checked={mode === "all"} onChange={() => setMode("all")} />
                <span>
                  <strong>Tout ce que j'ai partage</strong>
                  <small className="text-muted d-block">Cours, devoirs/examens, notes et emploi du temps marques comme partages.</small>
                </span>
              </label>
              <label className="scope-mode">
                <input type="radio" className="form-check-input" checked={mode === "custom"} onChange={() => setMode("custom")} />
                <span>
                  <strong>Seulement ce que je choisis</strong>
                  <small className="text-muted d-block">Les cours et notes cochés ci-dessous. Les devoirs et l'emploi du temps ne sont pas visibles.</small>
                </span>
              </label>

              {mode === "custom" && (
                <div className="scope-picker">
                  {options.courses.length === 0 && <p className="text-muted small mb-0">Vous n'avez aucun cours pour le moment.</p>}
                  {options.courses.map((course) => {
                    const courseNotes = notesByCourse[course._id] || [];
                    return (
                      <div className="scope-course" key={course._id}>
                        <label className="scope-row">
                          <input type="checkbox" className="form-check-input" checked={selCourses.includes(course._id)} onChange={() => toggleId(selCourses, setSelCourses, course._id)} />
                          <span className="scope-dot" style={{ background: course.color }} />
                          <strong>{course.title}</strong>
                          {!includeUnshared && !course.sharedWithViewers && <span className="scope-badge">cours non partage</span>}
                        </label>
                        {courseNotes.length > 0 && (
                          <div className="scope-notes">
                            {courseNotes.map((n) => {
                              // Deja incluse automatiquement si son cours est coche.
                              const auto = includeContent && selCourses.includes(course._id);
                              return (
                                <label className="scope-row" key={n._id}>
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={auto || selNotes.includes(n._id)}
                                    disabled={auto}
                                    onChange={() => toggleId(selNotes, setSelNotes, n._id)}
                                  />
                                  <span>{n.title}</span>
                                  {auto && <span className="scope-badge scope-badge-on">incluse</span>}
                                  {!includeUnshared && !n.sharedWithViewers && <span className="scope-badge">non partagee</span>}
                                </label>
                              );
                            })}
                            {!(includeContent && selCourses.includes(course._id)) && (
                              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => selectAllNotes(courseNotes)}>
                                Cocher / decocher toutes les notes
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="scope-options">
                    <label className="scope-row">
                      <input type="checkbox" className="form-check-input" checked={includeContent} onChange={(e) => setIncludeContent(e.target.checked)} />
                      <span>
                        <strong>Tout le contenu des cours coches</strong>
                        <small className="text-muted d-block">Toutes leurs notes, avec leurs fichiers et leurs sous-notes, sans avoir a les cocher une par une.</small>
                      </span>
                    </label>
                    <label className="scope-row">
                      <input type="checkbox" className="form-check-input" checked={includeUnshared} onChange={(e) => setIncludeUnshared(e.target.checked)} />
                      <span>
                        <strong>Aussi ce qui n'est pas partage</strong>
                        <small className="text-muted d-block">
                          Les elements avec l'oeil barre deviennent visibles pour les lecteurs de ce code (cours, notes, fichiers).
                          Decochez pour ne montrer que ce qui est partage.
                        </small>
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {formError && <div className="alert alert-danger py-2 mt-2 mb-0">{formError}</div>}

              <div className="d-flex flex-wrap gap-2 mt-3">
                {!editingCodeId && (
                  <input
                    type="number" min="1" className="form-control" style={{ maxWidth: 220 }}
                    placeholder="Expiration (jours, optionnel)"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                  />
                )}
                <button type="button" className="btn btn-primary btn-animated" onClick={submitCode} disabled={saving}>
                  <Icon name={editingCodeId ? "check-lg" : "plus-lg"} className="me-1" />
                  {saving ? "..." : editingCodeId ? "Enregistrer les modifications" : "Generer un code"}
                </button>
                {editingCodeId && (
                  <button type="button" className="btn btn-outline-secondary" onClick={resetForm}>Annuler</button>
                )}
              </div>
            </div>

            {loadingCodes && <p className="text-muted small mb-0">Chargement...</p>}
            {!loadingCodes && codes.length === 0 && <p className="text-muted small mb-0">Aucun code genere pour le moment.</p>}
            <div className="access-code-list">
              {codes.map((c) => (
                <div key={c._id} className={`access-code-row ${c.revoked ? "access-code-revoked" : ""}`}>
                  <code>{c.code}</code>
                  <div className="access-code-meta">
                    <div className="small mb-1">
                      {c.restricted ? (
                        <>
                          <span className="scope-badge scope-badge-on">Acces choisi</span>{" "}
                          <span className="text-muted">
                            {(c.courses || []).map((x) => x.title).join(", ") || "aucun cours"}
                            {" · "}
                            {(c.notes || []).length} note{(c.notes || []).length > 1 ? "s" : ""}
                            {c.includeCourseContent ? " + tout le contenu des cours" : ""}
                            {c.includeUnshared ? " · y compris non partage" : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">Tout ce qui est partage</span>
                      )}
                    </div>
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
                      <button className="btn-icon" onClick={() => startEdit(c)} aria-label="Modifier l'acces du code" title="Modifier ce que le code donne a voir"><Icon name="pencil" size={14} /></button>
                    )}
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