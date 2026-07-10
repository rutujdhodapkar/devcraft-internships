import React, { useState, useEffect } from "react";
import { notify } from "../services/notify";

const card = { border: "2px solid #000", padding: "1.5rem", boxShadow: "4px 4px 0 #000", marginBottom: "1.25rem" };
const inputS = { border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", marginBottom: "0.5rem" };

export default function UniversityOrgPage({ onClose, isAdmin, user }) {
  const [content, setContent] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ about: "", contactEmail: "", phone: "", scheduleLink: "", address: "", benefits: "", faq: "" });
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    import("../services/data").then(({ fetchSiteConfig }) =>
      fetchSiteConfig("university_org").then(d => {
        if (d) { try { setContent(typeof d === "string" ? JSON.parse(d) : d); } catch { setContent(null); } }
      })
    );
  }, []);

  const openEditor = () => {
    const c = content || { about: "DEV/CRAFT partners with universities and organizations to provide structured internship programs for students and professionals.", contactEmail: "partner@devcraft.com", phone: "+1 (555) 000-0000", scheduleLink: "https://calendly.com/devcraft", address: "DEV/CRAFT HQ", benefits: "• Curriculum-aligned internships\n• Track student progress\n• Official certification\n• Skilled intern pipeline\n• Custom program design\n• Performance analytics", faq: "Q: How do I partner with DEV/CRAFT?\nA: Reach out via email or schedule a call.\n\nQ: Can my students get certificates?\nA: Yes, all interns receive certificates." };
    setEditForm({ about: c.about || "", contactEmail: c.contactEmail || "", phone: c.phone || "", scheduleLink: c.scheduleLink || "", address: c.address || "", benefits: c.benefits || "", faq: c.faq || "" });
    setEditing(true);
  };

  const saveContent = async () => {
    const { saveSiteConfig } = await import("../services/data");
    await saveSiteConfig("university_org", JSON.stringify(editForm));
    setContent(editForm);
    setEditing(false);
    notify("Page updated!");
  };

  const defaults = { about: "DEV/CRAFT works with universities and organizations to give learners structured, job-ready project experience.", contactEmail: "partner@devcraft.com", phone: "Contact us by email", scheduleLink: "", address: "Remote program", benefits: "Curriculum-aligned project tracks\nStudent progress visibility\nVerified completion credentials\nCustom program support", faq: "How do we start?\nEmail the partnerships team with your program goals.\n\nCan programs be customized?\nYes. We can align projects and reporting to your cohort." };
  const c = { ...defaults, ...(editing ? editForm : content || {}) };
  const tab = (id, label) => <button type="button" onClick={() => setActiveTab(id)} style={{ padding: "0.45rem 0.85rem", border: "2px solid #000", background: activeTab === id ? "#000" : "#fff", color: activeTab === id ? "#fff" : "#000", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer" }}>{label}</button>;

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ background: "#000", color: "#fff", padding: "1.5rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 900, textTransform: "uppercase", margin: 0 }}>University & Organizations</h1>
          <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: "0.25rem 0 0" }}>Partner with DEV/CRAFT for internship programs</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={onClose} className="btn-sharp" style={{ padding: "0.35rem 0.9rem", fontSize: "0.8rem", background: "#fff", color: "#000", border: "2px solid #fff" }}>Back</button>
          {isAdmin && !editing && <button onClick={openEditor} className="btn-sharp" style={{ padding: "0.35rem 0.9rem", fontSize: "0.8rem", background: "transparent", color: "#fff", border: "2px solid #fff" }}>Edit</button>}
        </div>
      </div>

      {editing ? (
        <div style={card}>
          <h3 style={{ marginBottom: "1.25rem", fontSize: "1rem", fontWeight: 800, textTransform: "uppercase" }}>Edit Page</h3>
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>About</label>
          <textarea rows={3} value={editForm.about} onChange={e => setEditForm(p => ({ ...p, about: e.target.value }))} style={{ ...inputS, resize: "vertical" }} />
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Contact Email</label>
          <input value={editForm.contactEmail} onChange={e => setEditForm(p => ({ ...p, contactEmail: e.target.value }))} style={inputS} />
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Phone</label>
          <input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} style={inputS} />
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Schedule Call Link</label>
          <input value={editForm.scheduleLink} onChange={e => setEditForm(p => ({ ...p, scheduleLink: e.target.value }))} style={inputS} placeholder="https://calendly.com/..." />
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Address</label>
          <input value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} style={inputS} />
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Benefits</label>
          <textarea rows={5} value={editForm.benefits} onChange={e => setEditForm(p => ({ ...p, benefits: e.target.value }))} style={{ ...inputS, resize: "vertical" }} />
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>FAQ</label>
          <textarea rows={6} value={editForm.faq} onChange={e => setEditForm(p => ({ ...p, faq: e.target.value }))} style={{ ...inputS, resize: "vertical" }} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button onClick={saveContent} className="btn-sharp" style={{ padding: "0.45rem 1.25rem", background: "#000", color: "#fff" }}>Save</button>
            <button onClick={() => setEditing(false)} className="btn-sharp" style={{ padding: "0.45rem 1.25rem" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <><div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>{tab("overview", "Overview")}{tab("program", "Program benefits")}{tab("contact", "Contact")}</div><div style={{ display: "grid", gap: "1.25rem" }}>
          {activeTab === "overview" && <><div style={card}>
            <h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>About</h3>
            <p style={{ fontSize: "0.9rem", lineHeight: "1.6" }}>{c.about || "Loading..."}</p>
          </div>
          <div style={card}><h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>Designed for cohorts</h3><p style={{ fontSize: "0.9rem", lineHeight: "1.6" }}>Give your students practical work, clear milestones, and a single place to track progress. Our team can support short programs, semester cohorts, or partner-led tracks.</p></div></>}
          {activeTab === "contact" && <div style={card}>
            <h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>Contact</h3>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem 1rem", fontSize: "0.9rem" }}>
              <span style={{ fontWeight: 700 }}>Email</span><span>{c.contactEmail}</span>
              <span style={{ fontWeight: 700 }}>Phone</span><span>{c.phone}</span>
              <span style={{ fontWeight: 700 }}>Address</span><span>{c.address}</span>
            </div>
            {c.scheduleLink && (
              <a href={c.scheduleLink} target="_blank" rel="noopener noreferrer" className="btn-sharp" style={{ display: "inline-block", marginTop: "1rem", padding: "0.6rem 1.5rem", background: "#000", color: "#fff", textDecoration: "none", fontWeight: 700 }}>
                Schedule a Call
              </a>
            )}
          </div>}
          {activeTab === "program" && c.benefits && (
            <div style={card}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>Benefits</h3>
              <div style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "4px", fontFamily: "monospace", fontSize: "0.8rem", whiteSpace: "pre-wrap", lineHeight: "1.7" }}>
                {c.benefits}
              </div>
            </div>
          )}

          {activeTab === "program" && c.faq && (
            <div style={card}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>FAQ</h3>
              <div style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "4px", fontFamily: "monospace", fontSize: "0.8rem", whiteSpace: "pre-wrap", lineHeight: "1.7" }}>
                {c.faq}
              </div>
            </div>
          )}
        </div></>
      )}
    </div>
  );
}
