import React, { useCallback, useEffect, useState } from "react";

const typeStyles = {
  success: { bg: "#E8F5E9", border: "#34A853", color: "#1a5c2e", icon: "✓" },
  error: { bg: "#FFEBEE", border: "#EA4335", color: "#8b1a1a", icon: "✕" },
  warning: { bg: "#FFF8E1", border: "#FBBC05", color: "#7a5c00", icon: "!" },
  info: { bg: "#E3F2FD", border: "#4285F4", color: "#1a3a6c", icon: "i" },
};

let _id = 0;

export default function MessageBox() {
  const [items, setItems] = useState([]);

  const addItem = useCallback((msg, type, duration) => {
    const id = ++_id;
    setItems((prev) => [...prev, { id, message: msg, type: type || "info" }]);
    if (duration !== 0) {
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }, duration || 4000);
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { message, type, duration } = e.detail;
      addItem(message, type, duration);
    };
    window.addEventListener("devcraft-notify", handler);
    return () => window.removeEventListener("devcraft-notify", handler);
  }, [addItem]);

  if (!items.length) return null;

  return (
    <div style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 100000, display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "400px" }}>
      {items.map((item) => {
        const ts = typeStyles[item.type] || typeStyles.info;
        return (
          <div
            key={item.id}
            style={{
              background: ts.bg,
              border: `2px solid ${ts.border}`,
              color: ts.color,
              padding: "0.75rem 1rem",
              fontSize: "0.88rem",
              fontWeight: 600,
              boxShadow: "4px 4px 0 rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
              gap: "0.65rem",
              animation: "notifySlideIn 0.25s ease-out",
            }}
          >
            <span style={{
              width: "20px", height: "20px", borderRadius: "50%",
              background: ts.border, color: "#fff", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: "0.65rem", fontWeight: 900, flexShrink: 0,
            }}>{ts.icon}</span>
            <span style={{ flex: 1 }}>{item.message}</span>
            <button
              onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
              style={{ background: "none", border: "none", color: ts.color, cursor: "pointer", fontSize: "1rem", fontWeight: 900, padding: "0 0.25rem", lineHeight: 1 }}
            >×</button>
          </div>
        );
      })}
    </div>
  );
}
