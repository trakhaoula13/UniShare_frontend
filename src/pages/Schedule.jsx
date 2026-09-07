import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import PageWrapper from "../components/PageWrapper";
import Modal from "../components/Modal";
import useResource from "../hooks/useResource";
import useUndoDelete from "../hooks/useUndoDelete";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const emptyForm = { day: "Lundi", startTime: "", endTime: "", subject: "", room: "", type: "Cours" };

const Schedule = () => {
  const { items, setItems, create, update } = useResource("/schedule");
  const { showToast } = useToast();
  const { user } = useAuth();
  const isReadOnly = user?.role === "viewonly" || (user?.role === "user" && !!user?.sponsor);
  const [courses, setCourses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    api.get("/courses").then(({ data }) => setCourses(data));
  }, []);

  const deleteWithUndo = useUndoDelete({
    setItems,
    removeFn: (id) => api.delete(`/schedule/${id}`),
    getLabel: (item) => `${item.subject} (${item.day})`,
  });

  const toggleShare = (item) => {
    update(item._id, { sharedWithViewers: !item.sharedWithViewers });
    showToast(item.sharedWithViewers ? "Partage retire" : "Seance partagee", { type: "info" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await create(form);
    setForm(emptyForm);
    setShowModal(false);
    showToast("Seance ajoutee", { type: "success" });
  };

  return (
    <Layout title="Emploi du temps">
      <PageWrapper>
        {!isReadOnly && (
          <div className="d-flex justify-content-end mb-3">
            <button className="btn btn-primary btn-animated" onClick={() => setShowModal(true)}>
              <Icon name="plus-lg" className="me-1" />Ajouter une seance
            </button>
          </div>
        )}

        <div className="table-responsive panel-card">
          <table className="table schedule-table align-middle">
            <thead>
              <tr>
                <th>Jour</th><th>Horaire</th><th>Matiere</th><th>Salle</th><th>Type</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td className="fw-semibold">{item.day}</td>
                  <td>{item.startTime} - {item.endTime}</td>
                  <td>{item.subject}</td>
                  <td>{item.room || "-"}</td>
                  <td><span className={`type-badge badge-${item.type.toLowerCase()}`}>{item.type}</span></td>
                  <td>
                    {!isReadOnly && (
                      <div className="d-flex gap-1">
                        <button className="btn-icon" onClick={() => toggleShare(item)} aria-label="Basculer le partage" title={item.sharedWithViewers ? "Partage" : "Non partage"}>
                          <Icon name={item.sharedWithViewers ? "eye" : "eye-slash"} className={item.sharedWithViewers ? "text-success" : "text-muted"} size={15} />
                        </button>
                        <button className="btn-icon text-danger" onClick={() => deleteWithUndo(item)} aria-label="Supprimer la seance"><Icon name="trash" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan="6" className="text-center text-muted py-4">Aucune seance planifiee.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Modal show={showModal} onClose={() => setShowModal(false)} title="Nouvelle seance">
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-6 mb-3">
                <label className="form-label">Jour</label>
                <select className="form-select" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                  {days.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-6 mb-3">
                <label className="form-label">Type</label>
                <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option>Cours</option><option>TD</option><option>TP</option><option>Examen</option>
                </select>
              </div>
            </div>
            <div className="row">
              <div className="col-6 mb-3">
                <label className="form-label">Heure debut</label>
                <input type="time" className="form-control" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="col-6 mb-3">
                <label className="form-label">Heure fin</label>
                <input type="time" className="form-control" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Matiere</label>
              <select
                className="form-select"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              >
                <option value="">Choisir un cours...</option>
                {courses.map((c) => (
                  <option key={c._id} value={c.title}>{c.title}</option>
                ))}
              </select>
              {courses.length === 0 && (
                <small className="text-muted">Aucun cours cree. Ajoutez d'abord un cours dans "Cours".</small>
              )}
            </div>
            <div className="mb-3">
              <label className="form-label">Salle</label>
              <input className="form-control" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            </div>
            <button className="btn btn-primary w-100 btn-animated">Ajouter</button>
          </form>
        </Modal>
      </PageWrapper>
    </Layout>
  );
};

export default Schedule;