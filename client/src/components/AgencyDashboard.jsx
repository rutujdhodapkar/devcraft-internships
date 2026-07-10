import React, { useEffect, useState } from "react";
import { fetchAgencies, fetchAgencyEnrollments, addAgencyAdminEmail, removeAgencyAdminEmail } from "../services/data";
import { notify } from "../services/notify";

export default function AgencyDashboard({ user, onClose }) {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeAgency, setActiveAgency] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [enrLoading, setEnrLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [domains, setDomains] = useState([]);

  const userEmail = (user?.email || "").toLowerCase().trim();

  useEffect(() => {
    fetchAgencies().then(all => {
      const mine = all.filter(a =>
        a.approved && (a.emails || []).some(e => e.toLowerCase().trim() === userEmail)
      );
      setAgencies(mine);
      if (mine.length === 1) { setActiveAgency(mine[0]); loadEnrollments(mine[0].id); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userEmail]);

  useEffect(() => {
    if (!activeAgency) return;
    const apiBase = (import.meta.env.VITE_SERVER_URL || "https://devcraft.fennark.xyz").replace(/\/api\/?$/, "");
    fetch(`${apiBase}/api/data/career-paths`)
      .then(r => r.json())
      .then(data => {
        const all = Array.isArray(data) ? data : (data.data || []);
        if (activeAgency.id) setDomains(all.filter(d => d.agencyId === activeAgency.id || d.agencyId === activeAgency.name));
        else setDomains([]);
      })
      .catch(() => setDomains([]));
  }, [activeAgency]);

  const loadEnrollments = async (id) => {
    setEnrLoading(true);
    try { setEnrollments(await fetchAgencyEnrollments(id)); } catch (e) { setEnrollments([]); }
    finally { setEnrLoading(false); }
  };

  const selectAgency = (a) => { setActiveAgency(a); loadEnrollments(a.id); };

  const handleAddEmail = async () => {
    if (!newEmail.trim() || !activeAgency) return;
    setSaving(true);
    try {
      await addAgencyAdminEmail(activeAgency.id, newEmail.trim());
      const all = await fetchAgencies();
      const updated = all.find(a => a.id === activeAgency.id);
      if (updated) setActiveAgency(updated);
      setNewEmail("");
      notify("Admin email added!", "success");
    } catch (e) { notify("Error: " + e.message, "error"); }
    finally { setSaving(false); }
  };

  const handleRemoveEmail = async (email) => {
    if (!activeAgency) return;
    if (email === userEmail) { notify("Cannot remove yourself.", "warning"); return; }
    setSaving(true);
    try {
      await removeAgencyAdminEmail(activeAgency.id, email);
      const all = await fetchAgencies();
      const updated = all.find(a => a.id === activeAgency.id);
      if (updated) setActiveAgency(updated);
      notify("Admin email removed!", "success");
    } catch (e) { notify("Error: " + e.message, "error"); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", color: "#888" }}>Loading...</div>
  );

  if (agencies.length === 0) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div style={{ border: "2px solid #000", padding: "2rem", boxShadow: "4px 4px 0 #000", textAlign: "center", maxWidth: "400px" }}>
        <h2 style={{ fontWeight: 900, textTransform: "uppercase", marginBottom: "0.5rem" }}>No Agency Access</h2>
        <p style={{ color: "#666", marginBottom: "1rem" }}>Your email is not registered as an admin for any approved agency.</p>
        <button onClick={onClose} className="btn-sharp" style={{ padding: "0.5rem 1.5rem" }}>Back to Site</button>
      </div>
    </div>
  );

  const a = activeAgency;

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase" }}>Agency Dashboard</h1>
        <button onClick={onClose} className="btn-sharp" style={{ padding: "0.4rem 1rem", fontSize: "0.8rem", background: "#fff", color: "#000", border: "2px solid #000" }}>Back to Site</button>
      </div>

      {agencies.length > 1 && (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {agencies.map(ag => (
            <button key={ag.id} onClick={() => selectAgency(ag)} style={{
              padding: "0.4rem 1rem", fontSize: "0.82rem", fontWeight: 700, border: "2px solid #000",
              background: activeAgency?.id === ag.id ? "#000" : "#fff", color: activeAgency?.id === ag.id ? "#fff" : "#000", cursor: "pointer",
            }}>{ag.name}</button>
          ))}
        </div>
      )}

      {a && (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          <div style={{ border: "2px solid #000", padding: "1.25rem", boxShadow: "4px 4px 0 #000" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              {a.logo && <img src={a.logo} alt="" style={{ width: "48px", height: "48px", objectFit: "contain", border: "1px solid #ddd" }} />}
              <div>
                <h2 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.1rem" }}>{a.name}</h2>
                {a.website && <a href={a.website} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", color: "#1565c0" }}>{a.website}</a>}
              </div>
            </div>
            {a.description && <p style={{ fontSize: "0.85rem", color: "#666" }}>{a.description}</p>}
          </div>

          <div style={{ border: "2px solid #000", padding: "1.25rem", boxShadow: "4px 4px 0 #000" }}>
            <h3 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "0.9rem", marginBottom: "0.75rem" }}>Domains ({domains.length})</h3>
            {domains.length === 0 ? (
              <p style={{ color: "#888", fontStyle: "italic" }}>No domains associated with this agency yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "0.4rem", maxHeight: "300px", overflowY: "auto" }}>
                {domains.map(d => (
                  <div key={d.id} style={{ border: "1px solid #ddd", padding: "0.5rem 0.7rem", fontSize: "0.82rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700 }}>{d.title || d.name}</span>
                      <span style={{ color: "#888", fontSize: "0.75rem" }}>{d.duration}</span>
                    </div>
                    {d.description && <p style={{ color: "#666", fontSize: "0.78rem", marginTop: "0.25rem" }}>{d.description}</p>}
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <span style={{ fontSize: "0.72rem", color: "#888" }}>Projects: {d.projects?.length || 0}</span>
                      {d.paymentAmount && <span style={{ fontSize: "0.72rem", color: "#888" }}>${d.paymentAmount}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ border: "2px solid #000", padding: "1.25rem", boxShadow: "4px 4px 0 #000" }}>
            <h3 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "0.9rem", marginBottom: "0.75rem" }}>Applied Users ({enrollments.length})</h3>
            {enrLoading ? <p style={{ color: "#888" }}>Loading...</p> : enrollments.length === 0 ? (
              <p style={{ color: "#888", fontStyle: "italic" }}>No users have applied through this agency yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "0.4rem", maxHeight: "350px", overflowY: "auto" }}>
                {enrollments.map(e => (
                  <div key={e.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", border: "1px solid #ddd", padding: "0.5rem 0.7rem", fontSize: "0.82rem" }}>
                    <span style={{ fontWeight: 700, minWidth: "120px" }}>{e.name || "—"}</span>
                    <span style={{ color: "#888", minWidth: "100px" }}>{e.domain || e.domainId || "—"}</span>
                    <span style={{ color: "#888", minWidth: "160px" }}>{e.email || ""}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 700, color: e.status === "Completed" ? "#090" : e.status === "Active" ? "#FBBC05" : "#888" }}>{e.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ border: "2px solid #000", padding: "1.25rem", boxShadow: "4px 4px 0 #000" }}>
            <h3 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "0.9rem", marginBottom: "0.75rem" }}>Manage Admin Emails</h3>
            <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.75rem" }}>Add or remove admin emails for your agency. You cannot remove yourself.</p>
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@example.com" style={{ border: "2px solid #000", padding: "0.4rem 0.6rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", flex: 1 }} />
              <button onClick={handleAddEmail} disabled={saving} className="btn-sharp" style={{ padding: "0.4rem 1rem", fontSize: "0.8rem" }}>{saving ? "..." : "Add"}</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {(a.emails || []).map(em => (
                <div key={em} style={{ display: "flex", alignItems: "center", gap: "0.3rem", border: "1px solid #000", padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}>
                  <span>{em}</span>
                  {em !== userEmail && (
                    <button onClick={() => handleRemoveEmail(em)} disabled={saving} style={{ border: "none", background: "none", cursor: "pointer", color: "#EA4335", fontSize: "0.8rem", padding: 0 }}>×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
