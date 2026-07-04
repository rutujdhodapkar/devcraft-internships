import React, { useEffect, useState } from "react";

export default function VerifyCertificate() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean);
    const enrollmentId = parts[1];
    if (!enrollmentId) {
      setError("Invalid verification link.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/verify-data/${encodeURIComponent(enrollmentId)}`);
        const json = await res.json();
        if (!json.success) { setError(json.message || "Verification failed."); return; }
        setData(json.data);
      } catch (err) {
        setError("Failed to load verification data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.6)", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "Arial, sans-serif",
      }}
      onClick={() => window.history.pushState(null, "", "/") || (window.location.pathname = "/")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", maxWidth: "460px", width: "90%",
          padding: "2rem", border: "3px solid #000",
          boxShadow: "8px 8px 0 #000", position: "relative",
        }}
      >
        <button
          onClick={() => window.history.pushState(null, "", "/") || (window.location.pathname = "/")}
          style={{ position: "absolute", top: "10px", right: "14px", background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", fontWeight: 700, color: "#888" }}
        >
          ✕
        </button>

        {error ? (
          <>
            <h2 style={{ color: "#EA4335", margin: 0 }}>Not Found</h2>
            <p style={{ color: "#555", marginTop: "0.5rem" }}>{error}</p>
          </>
        ) : data ? (
          <>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{ display: "inline-block", background: "#000", color: "#fff", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "2px", padding: "4px 12px", textTransform: "uppercase" }}>
                DevCraft
              </div>
            </div>
            <h2 style={{ textAlign: "center", fontSize: "1.6rem", fontWeight: 900, margin: "0.5rem 0" }}>{data.name}</h2>
            <p style={{ textAlign: "center", fontSize: "1rem", color: "#555", margin: "0.25rem 0 1rem" }}>{data.domain}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderTop: "2px solid #000", paddingTop: "1rem" }}>
              <Row label="Status" value={data.status} color={data.status === "Completed" ? "#34A853" : "#FBBC05"} />
              <Row label="Intern ID" value={data.internId} />
              <Row label="Certificate" value={data.certificate} color={data.certificate === "Available" ? "#34A853" : "#888"} />
              <Row label="Started" value={data.started} />
              <Row label="Completed" value={data.completed} />
            </div>
            <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.75rem", color: "#aaa", letterSpacing: "0.5px" }}>
              DEV/CRAFT Virtual Internship Program
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0", borderBottom: "1px solid #f0f0f0" }}>
      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#888", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: "0.88rem", fontWeight: 700, color: color || "#000" }}>{value || "N/A"}</span>
    </div>
  );
}
