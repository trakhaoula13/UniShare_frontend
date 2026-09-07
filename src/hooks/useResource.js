import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

// Hook CRUD generique : evite de reecrire le meme load/create/update/remove
// dans chaque page (Courses, Assignments, Notes, Research, Todos, Schedule
// utilisaient tous un code quasi identique).
export default function useResource(endpoint) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint);
      setItems(data);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (payload) => {
    const { data } = await api.post(endpoint, payload);
    setItems((prev) => [data, ...prev]);
    return data;
  };

  const update = async (id, payload) => {
    const { data } = await api.put(`${endpoint}/${id}`, payload);
    setItems((prev) => prev.map((item) => (item._id === id ? data : item)));
    return data;
  };

  const remove = async (id) => {
    await api.delete(`${endpoint}/${id}`);
    setItems((prev) => prev.filter((item) => item._id !== id));
  };

  return { items, setItems, loading, load, create, update, remove };
}
