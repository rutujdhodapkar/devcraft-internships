import { useEffect, useState } from "react";
import { fetchTemplates } from "../services/data";

function fillTemplate(html, vars) {
  let result = html;
  Object.entries(vars).forEach(([k, v]) => {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v || "");
  });
  return result;
}

export default function IDCardModal({
  user,
  userProfile,
  enrollment,
  onClose,
}) {
  const [templates, setTemplates] = useState(null);

  useEffect(() => {
    fetchTemplates().then((d) => setTemplates(d?.templates || {})).catch(() => {});
  }, []);

  const name =
    enrollment?.name || userProfile?.name || user?.displayName || "Student";
  const internId = enrollment?.internId || enrollment?.id || "Pending";
  const email = user?.email || enrollment?.email || userProfile?.email || "";
  const phone = userProfile?.phone || enrollment?.phone || "";
  const city = userProfile?.city || enrollment?.city || "";
  const college = userProfile?.college || enrollment?.college || "";
  const country = userProfile?.country || enrollment?.country || "";
  const domain = enrollment?.domain || "";
  const initial = name.charAt(0).toUpperCase();
  const photoUrl = user?.photoURL || "";
  const date = new Date(enrollment?.createdAt || Date.now()).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const qrCodeUrl = `${window.location.origin}/api/qr/${encodeURIComponent(internId)}`;

  const templateHtml = templates?.["ID Card"] || templates?.["id-card"] || null;

  const cardContent = templateHtml
    ? fillTemplate(templateHtml, {
        name, email, phone, city, college, country, domain,
        internId, id: enrollment?.id || internId, date, photoUrl, qrCodeUrl,
      })
    : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
        padding: "1.5rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          border: "3px solid #000",
          boxShadow: "10px 10px 0 #000",
          width: "100%",
          maxWidth: "380px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {cardContent ? (
          <div dangerouslySetInnerHTML={{ __html: cardContent }} />
        ) : (
          <>
            <div
              style={{
                background: "#000",
                color: "#fff",
                padding: "1.1rem 1.4rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "1.15rem", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  DevCraft
                </div>
                <div style={{ fontSize: "0.62rem", color: "#bbb", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "0.1rem" }}>
                  Intern Identity Card
                </div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "1.5px solid #555", color: "#fff", width: "26px", height: "26px", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1 }}>
                ×
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1.25rem 1.4rem 1rem", borderBottom: "2px solid #000" }}>
              {photoUrl ? (
                <img src={photoUrl} alt={name} style={{ width: "58px", height: "58px", border: "2.5px solid #000", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: "58px", height: "58px", border: "2.5px solid #000", background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 900, flexShrink: 0 }}>
                  {initial}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 900, fontSize: "1.15rem", color: "#000", lineHeight: 1.2 }}>{name}</div>
                <div style={{ display: "inline-block", marginTop: "0.35rem", background: "#000", color: "#fff", fontSize: "0.6rem", fontWeight: 800, padding: "0.15rem 0.55rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Intern
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.1rem", padding: "1.25rem 1.4rem" }}>
              {[
                ["Intern ID", internId],
                ["City", city],
                ["Phone", phone],
                ["Internship", domain || "Not enrolled yet"],
                ["Email", email],
              ].map(([label, value], i) => (
                <div key={label} style={i === 4 ? { gridColumn: "1 / -1" } : {}}>
                  <div style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", color: "#888", letterSpacing: "0.1em", marginBottom: "0.18rem" }}>{label}</div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#000", wordBreak: "break-all", lineHeight: 1.3 }}>{value || "—"}</div>
                </div>
              ))}
            </div>
            {internId && internId !== "Pending" && (
              <div style={{ padding: "0 1.4rem 1rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <img src={qrCodeUrl} alt="Verify QR" style={{ width: "90px", height: "90px", border: "2px solid #000" }} />
                <div style={{ fontSize: "0.55rem", color: "#888", marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Scan to Verify</div>
              </div>
            )}
            <div style={{ background: "#f5f5f5", borderTop: "2px solid #000", padding: "0.7rem 1.4rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "0.65rem", color: "#888", fontWeight: 600 }}>DevCraft Internship Program</div>
              <div style={{ background: "#000", color: "#fff", fontSize: "0.6rem", fontWeight: 800, padding: "0.18rem 0.55rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Official</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
