import { useRef } from "react";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";

const UNDO_DELAY = 4000;

// Combine confirmation (remplace window.confirm) + suppression differee
// annulable : l'element disparait immediatement de l'ecran, mais l'appel
// DELETE reel n'est envoye qu'apres quelques secondes -- le temps de
// laisser un "Annuler" dans le toast affiche.
export default function useUndoDelete({ setItems, removeFn, getLabel }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const pendingTimeouts = useRef({});

  const deleteWithUndo = async (item) => {
    const ok = await confirm(`Supprimer "${getLabel(item)}" ? Cette action est definitive.`);
    if (!ok) return;

    setItems((prev) => prev.filter((i) => i._id !== item._id));

    pendingTimeouts.current[item._id] = setTimeout(async () => {
      try {
        await removeFn(item._id);
      } catch {
        // en cas d'echec silencieux, l'element reste absent de l'UI ;
        // un rechargement de page le fera reapparaitre s'il existe toujours.
      }
      delete pendingTimeouts.current[item._id];
    }, UNDO_DELAY);

    showToast(`"${getLabel(item)}" supprime.`, {
      type: "info",
      action: {
        label: "Annuler",
        onClick: () => {
          clearTimeout(pendingTimeouts.current[item._id]);
          delete pendingTimeouts.current[item._id];
          setItems((prev) => [item, ...prev]);
        },
      },
    });
  };

  return deleteWithUndo;
}
