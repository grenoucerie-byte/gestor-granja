import { useState, useEffect } from "react";

export const usePizarra = ({ isCloudConnected, sbFetch, setCloudSaveError }) => {
  const [notasPizarra, setNotasPizarra] = useState(() => {
    const saved = localStorage.getItem("grenoucerie_notas_pizarra");
    return saved ? JSON.parse(saved) : [];
  });
  const [showFormNota, setShowFormNota] = useState(false);
  const [formNota, setFormNota] = useState({ texto: "", area: "General", prioridad: "normal", autor: "" });

  useEffect(() => {
    localStorage.setItem("grenoucerie_notas_pizarra", JSON.stringify(notasPizarra));
  }, [notasPizarra]);

  const guardarNotaPizarra = async () => {
    if (!formNota.texto.trim()) return;
    const nueva = {
      id: Date.now(),
      texto: formNota.texto.trim(),
      area: formNota.area,
      prioridad: formNota.prioridad,
      autor: formNota.autor.trim() || "Anónimo",
      pinned: false,
      created_at: new Date().toISOString(),
    };
    setNotasPizarra(prev => [nueva, ...prev]);
    setFormNota({ texto: "", area: "General", prioridad: "normal", autor: formNota.autor });
    setShowFormNota(false);

    if (isCloudConnected) {
      try {
        const res = await sbFetch("notas_pizarra", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(nueva),
        });
        if (res && !res.ok) {
          const errBody = await res.text().catch(() => "");
          if (errBody.includes("notas_pizarra")) {
            setCloudSaveError("Tabla notas_pizarra no existe. Créala en Supabase con el SQL proporcionado.");
          }
        }
      } catch (err) {
        console.error("Error al guardar nota en la nube:", err);
      }
    }
  };

  const togglePinNota = async (id) => {
    setNotasPizarra(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
    if (isCloudConnected) {
      const nota = notasPizarra.find(n => n.id === id);
      try {
        await sbFetch(`notas_pizarra?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify({ pinned: !nota?.pinned }),
        });
      } catch (err) {
        console.error("Error al fijar nota:", err);
      }
    }
  };

  const borrarNotaPizarra = async (id) => {
    setNotasPizarra(prev => prev.filter(n => n.id !== id));
    if (isCloudConnected) {
      try {
        await sbFetch(`notas_pizarra?id=eq.${id}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Error al borrar nota:", err);
      }
    }
  };

  return {
    notasPizarra, setNotasPizarra,
    showFormNota, setShowFormNota,
    formNota, setFormNota,
    guardarNotaPizarra, togglePinNota, borrarNotaPizarra,
  };
};
