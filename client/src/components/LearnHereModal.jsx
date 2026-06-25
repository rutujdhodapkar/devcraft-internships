import React, { useEffect } from 'react';

export default function LearnHereModal({ documents, projectName, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!documents || !documents.length) return null;

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
          boxShadow: "8px 8px 0 #000", width: "100%", maxWidth: "600px",
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
          <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.1rem", marginBottom: "1.25rem" }}>
            Learning Resources - {projectName}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {documents.map((doc, idx) => (
              <div key={idx} style={{ border: "2px solid #000", padding: "1rem 1.25rem", background: "#fafafa" }}>
                {doc.title && (
                  <h4 style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: "0.4rem", textTransform: "uppercase" }}>
                    {doc.title}
                  </h4>
                )}
                {doc.description && (
                  <p style={{ fontSize: "0.88rem", color: "#555", lineHeight: "1.6", marginBottom: "0.75rem" }}>
                    {doc.description}
                  </p>
                )}
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-sharp"
                    style={{ display: "inline-block", padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" }}
                  >
                    Open Resource →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
