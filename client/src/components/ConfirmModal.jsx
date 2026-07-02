import React, { useCallback, useEffect, useState } from "react";
import { resolveConfirm } from "../services/confirm";

export default function ConfirmModal() {
  const [item, setItem] = useState(null);

  const handler = useCallback((e) => {
    setItem({ message: e.detail.message });
  }, []);

  useEffect(() => {
    window.addEventListener("devcraft-confirm", handler);
    return () => window.removeEventListener("devcraft-confirm", handler);
  }, [handler]);

  useEffect(() => {
    const closeHandler = () => setItem(null);
    window.addEventListener("devcraft-confirm-resolve", closeHandler);
    return () => window.removeEventListener("devcraft-confirm-resolve", closeHandler);
  }, []);

  if (!item) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }} onClick={() => { resolveConfirm(false); setItem(null); }}>
      <div style={{ background: "#fff", border: "3px solid #000", boxShadow: "8px 8px 0 #000", padding: "2rem", maxWidth: "420px", width: "90%" }} onClick={(e) => e.stopPropagation()}>
        <p style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.5, margin: "0 0 1.5rem", color: "#000" }}>{item.message}</p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button className="btn-sharp" onClick={() => { resolveConfirm(false); setItem(null); }} style={{ padding: "0.6rem 1.25rem", fontSize: "0.85rem", fontWeight: 700, background: "#fff", color: "#000", border: "2px solid #000", cursor: "pointer" }}>
            Cancel
          </button>
          <button className="btn-sharp" onClick={() => { resolveConfirm(true); setItem(null); }} style={{ padding: "0.6rem 1.25rem", fontSize: "0.85rem", fontWeight: 700, background: "#000", color: "#fff", border: "2px solid #000", cursor: "pointer" }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
