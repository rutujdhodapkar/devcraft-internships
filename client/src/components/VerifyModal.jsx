import React from "react";

function fmt(d) {
  if (!d) return null;
  const dt = typeof d === "object" && d?.seconds ? new Date(d.seconds * 1000) : new Date(d);
  if (isNaN(dt.getTime())) return null;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default function VerifyModal({ enrollment, onClose }) {
  const statusColor = enrollment?.status === "Completed" ? "#2e7d32" : enrollment?.status === "Active" ? "#1565c0" : "#ff8f00";
  const certAvailable = enrollment?.allowedCertificate === "yes";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000, padding: "1.5rem" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", border: "3px solid #000", boxShadow: "10px 10px 0 #000", width: "100%", maxWidth: "400px", textAlign: "center", padding: "2rem" }}>
        <div style={{ height: "6px", background: "#000", margin: "-2rem -2rem 1.5rem -2rem" }} />
        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, margin: "0 0 0.2rem" }}>{enrollment?.name || "Intern"}</h1>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: statusColor, margin: "0 0 1.25rem" }}>{enrollment?.domain || ""}</h2>

        <table style={{ margin: "0 auto", borderCollapse: "collapse", fontSize: "0.9rem", width: "100%" }}>
          <tbody>
            <tr><td style={{ fontWeight: 700, color: "#555", padding: "6px 16px", borderBottom: "1px solid #ddd", textAlign: "left" }}>Status</td><td style={{ padding: "6px 16px", borderBottom: "1px solid #ddd", textAlign: "left" }}>{enrollment?.status || "N/A"}</td></tr>
            <tr><td style={{ fontWeight: 700, color: "#555", padding: "6px 16px", borderBottom: "1px solid #ddd", textAlign: "left" }}>Intern ID</td><td style={{ padding: "6px 16px", borderBottom: "1px solid #ddd", textAlign: "left" }}>{enrollment?.internId || enrollment?.id || ""}</td></tr>
            <tr><td style={{ fontWeight: 700, color: "#555", padding: "6px 16px", borderBottom: "1px solid #ddd", textAlign: "left" }}>Certificate</td><td style={{ padding: "6px 16px", borderBottom: "1px solid #ddd", textAlign: "left", color: certAvailable ? "#2e7d32" : "#888" }}>{certAvailable ? "Available" : "Locked"}</td></tr>
            <tr><td style={{ fontWeight: 700, color: "#555", padding: "6px 16px", borderBottom: "1px solid #ddd", textAlign: "left" }}>Started</td><td style={{ padding: "6px 16px", borderBottom: "1px solid #ddd", textAlign: "left" }}>{fmt(enrollment?.startDate || enrollment?.createdAt) || "N/A"}</td></tr>
            <tr><td style={{ fontWeight: 700, color: "#555", padding: "6px 16px", borderBottom: "1px solid #ddd", textAlign: "left" }}>Completed</td><td style={{ padding: "6px 16px", borderBottom: "1px solid #ddd", textAlign: "left" }}>{fmt(enrollment?.completedAt) || "In progress"}</td></tr>
          </tbody>
        </table>

        <div style={{ marginTop: "1.75rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onClose} className="btn-sharp" style={{ padding: "0.5rem 1.5rem", fontSize: "0.85rem", background: "#000", color: "#fff", border: "2px solid #000", cursor: "pointer", borderRadius: 0, fontWeight: 700 }}>
            Close
          </button>
        </div>

        <p style={{ marginTop: "1rem", color: "#888", fontSize: "0.75rem" }}>DEV/CRAFT Virtual Internship</p>
      </div>
    </div>
  );
}