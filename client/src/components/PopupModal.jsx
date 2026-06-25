import React from 'react';

export default function PopupModal({ show, onClose, settings }) {
  if (!show || !settings?.enabled) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
        display: "flex", justifyContent: "center", alignItems: "flex-start",
        zIndex: 2000, overflowY: "auto", padding: "2rem 1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", border: "3px solid #000",
          boxShadow: "8px 8px 0 #000", width: "100%", maxWidth: "480px",
          position: "relative", marginTop: "2rem",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "0.5rem", right: "0.5rem", zIndex: 10,
            background: "#000", border: "none", color: "#fff", width: "32px",
            height: "32px", cursor: "pointer", fontSize: "1.2rem",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}
        >
          ×
        </button>
        <div style={{ height: "6px", background: "#000" }} />
        <div style={{ padding: "2rem" }}>
          {settings.imageUrl && (
            <img
              src={settings.imageUrl}
              alt=""
              style={{ width: "100%", maxHeight: "200px", objectFit: "contain", marginBottom: "1.25rem", border: "1px solid #eee" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          )}
          {settings.headline && (
            <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.25rem", marginBottom: "0.5rem" }}>
              {settings.headline}
            </h3>
          )}
          {settings.subheadline && (
            <p style={{ fontSize: "0.95rem", color: "#555", marginBottom: "0.75rem", fontWeight: 600 }}>
              {settings.subheadline}
            </p>
          )}
          {settings.description && (
            <p style={{ fontSize: "0.88rem", color: "#666", lineHeight: "1.6", marginBottom: "1rem" }}>
              {settings.description}
            </p>
          )}
          {settings.note && (
            <p style={{ fontSize: "0.78rem", color: "#888", fontStyle: "italic", marginBottom: "1.25rem" }}>
              {settings.note}
            </p>
          )}
          {settings.buttonText && (
            <a
              href={settings.buttonLink || "#"}
              target={settings.buttonLink?.startsWith("http") ? "_blank" : undefined}
              rel={settings.buttonLink?.startsWith("http") ? "noopener noreferrer" : undefined}
              className="btn-sharp"
              style={{ display: "inline-block", padding: "0.75rem 2rem", fontWeight: 800, textDecoration: "none", textAlign: "center" }}
            >
              {settings.buttonText}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
