import React, { useState, useEffect } from "react";
import { notify } from "../services/notify";

const card = { border: "2px solid #000", padding: "1.5rem", boxShadow: "4px 4px 0 #000", marginBottom: "1.25rem" };
const inputS = { border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", marginBottom: "0.5rem" };

export default function McpDashboard({ onClose, isAdmin, user }) {
  const [content, setContent] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ steps: "", mcpEndpoint: "", apiEndpoint: "", tools: "", limits: "" });
  const [reqForm, setReqForm] = useState({ email: "", name: "", reason: "", webhook: "" });
  const [reqStatus, setReqStatus] = useState("idle");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    import("../services/data").then(({ fetchSiteConfig }) =>
      fetchSiteConfig("mcp_dashboard").then(d => {
        if (d) { try { setContent(typeof d === "string" ? JSON.parse(d) : d); } catch { setContent(null); } }
      })
    );
  }, []);

  const openEditor = () => {
    const c = content || { steps: "1. Request access via the form below\n2. Admin reviews and approves\n3. Use the endpoint with your credentials\n4. Access domains, tasks, and data", mcpEndpoint: "https://devcraft.fennark.xyz/api/mcp-domains", apiEndpoint: "https://devcraft.fennark.xyz/api/data", tools: "get_domains, get_tasks, add_domain, add_task, lookup, edit_data", limits: "Rate limit: 100 req/min\nAuth: Bearer token or admin_secret\nRead: Public for authorized users\nWrite: Requires admin approval" };
    setEditForm({ steps: c.steps || "", mcpEndpoint: c.mcpEndpoint || "", apiEndpoint: c.apiEndpoint || "", tools: c.tools || "", limits: c.limits || "" });
    setEditing(true);
  };

  const saveContent = async () => {
    const { saveSiteConfig } = await import("../services/data");
    await saveSiteConfig("mcp_dashboard", JSON.stringify(editForm));
    setContent(editForm);
    setEditing(false);
    notify("Dashboard updated!");
  };

  const defaults = {
    steps: "1. Request access\n2. Receive approval and credentials\n3. Connect your client to the MCP endpoint\n4. Use only the tools assigned to your account",
    mcpEndpoint: "https://devcraft.fennark.xyz/api/mcp-domains",
    apiEndpoint: "https://devcraft.fennark.xyz/api/data",
    tools: "get_domains\nget_tasks\nlookup\nadd_domain (approval required)",
    limits: "Authentication: approved account required\nRate limit: 100 requests per minute\nWrite actions: reviewed by an administrator",
  };
  const c = { ...defaults, ...(editing ? editForm : content || {}) };
  const navButton = (id, label) => <button type="button" onClick={() => setActiveTab(id)} style={{ padding: "0.45rem 0.85rem", border: "2px solid #000", background: activeTab === id ? "#000" : "#fff", color: activeTab === id ? "#fff" : "#000", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer" }}>{label}</button>;

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ background: "#000", color: "#fff", padding: "1.5rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 900, textTransform: "uppercase", margin: 0 }}>MCP & API</h1>
          <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: "0.25rem 0 0" }}>Integrate DEV/CRAFT into your applications</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={onClose} className="btn-sharp" style={{ padding: "0.35rem 0.9rem", fontSize: "0.8rem", background: "#fff", color: "#000", border: "2px solid #fff" }}>Back</button>
          {isAdmin && !editing && <button onClick={openEditor} className="btn-sharp" style={{ padding: "0.35rem 0.9rem", fontSize: "0.8rem", background: "transparent", color: "#fff", border: "2px solid #fff" }}>Edit</button>}
        </div>
      </div>

      {editing ? (
        <div style={card}>
          <h3 style={{ marginBottom: "1.25rem", fontSize: "1rem", fontWeight: 800, textTransform: "uppercase" }}>Edit Dashboard</h3>
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Setup Steps</label>
          <textarea rows={4} value={editForm.steps} onChange={e => setEditForm(p => ({ ...p, steps: e.target.value }))} style={{ ...inputS, resize: "vertical" }} />
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>MCP Endpoint</label>
          <input value={editForm.mcpEndpoint} onChange={e => setEditForm(p => ({ ...p, mcpEndpoint: e.target.value }))} style={inputS} />
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>API Endpoint</label>
          <input value={editForm.apiEndpoint} onChange={e => setEditForm(p => ({ ...p, apiEndpoint: e.target.value }))} style={inputS} />
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Available Tools</label>
          <textarea rows={3} value={editForm.tools} onChange={e => setEditForm(p => ({ ...p, tools: e.target.value }))} style={{ ...inputS, resize: "vertical" }} />
          <label style={{ fontWeight: 700, fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>Rate Limits & Auth</label>
          <textarea rows={3} value={editForm.limits} onChange={e => setEditForm(p => ({ ...p, limits: e.target.value }))} style={{ ...inputS, resize: "vertical" }} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button onClick={saveContent} className="btn-sharp" style={{ padding: "0.45rem 1.25rem", background: "#000", color: "#fff" }}>Save</button>
            <button onClick={() => setEditing(false)} className="btn-sharp" style={{ padding: "0.45rem 1.25rem" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>{navButton("overview", "Overview")}{navButton("setup", "Setup & tools")}{navButton("access", "Request access")}</div>
          <div style={{ display: "grid", gap: "1.25rem" }}>
            {activeTab === "overview" && <>
              <div style={card}><h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>Connection endpoints</h3><div style={{ background: "#000", color: "#fff", padding: "1rem", fontFamily: "monospace", fontSize: "0.8rem", lineHeight: "1.9", overflowWrap: "anywhere" }}><div>MCP  {c.mcpEndpoint}</div><div>API  {c.apiEndpoint}</div></div></div>
              <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}><div><h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.5rem" }}>Who it is for</h3><p style={{ fontSize: "0.85rem", lineHeight: 1.6 }}>Approved partners building integrations with DEV/CRAFT domains, tasks, and workflows.</p></div><div><h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.5rem" }}>Your access</h3><p style={{ fontSize: "0.85rem", lineHeight: 1.6 }}>{user?.email ? `Signed in as ${user.email}` : "Sign in before requesting or using access."}</p></div></div>
            </>}
            {activeTab === "setup" && <><div style={card}><h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>Setup checklist</h3><div style={{ background: "#f5f5f5", padding: "1rem", fontFamily: "monospace", fontSize: "0.8rem", whiteSpace: "pre-wrap", lineHeight: "1.7" }}>{c.steps}</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}><div style={card}><h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>Available tools</h3><div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.8rem", lineHeight: 1.7 }}>{c.tools}</div></div><div style={card}><h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>Access policy</h3><div style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.8rem", lineHeight: 1.7 }}>{c.limits}</div></div></div></>}
            {activeTab === "access" && <div style={card}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>Request Access</h3>
              <p style={{ fontSize: "0.82rem", color: "#666", marginBottom: "0.75rem" }}>Submit a request to use MCP/API. Admin will review and approve.</p>
              {reqStatus === "sent" ? (
                <p style={{ color: "#000", fontWeight: 700 }}>Request submitted. Admin will notify you when approved.</p>
              ) : (
                <div style={{ display: "grid", gap: "0.5rem", maxWidth: "400px" }}>
                  <input value={reqForm.email} onChange={e => setReqForm(p => ({ ...p, email: e.target.value }))} placeholder="Your email *" style={inputS} />
                  <input value={reqForm.name} onChange={e => setReqForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" style={inputS} />
                  <input value={reqForm.reason} onChange={e => setReqForm(p => ({ ...p, reason: e.target.value }))} placeholder="Why do you need access?" style={inputS} />
                  <input value={reqForm.webhook} onChange={e => setReqForm(p => ({ ...p, webhook: e.target.value }))} placeholder="Webhook URL (optional)" style={inputS} />
                  <button onClick={async () => {
                    if (!reqForm.email) return;
                    setReqStatus("sending");
                    try {
                      const res = await fetch("/api/mcp-domains", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: "request_access", arguments: { email: reqForm.email, name: reqForm.name, reason: reqForm.reason, webhook_url: reqForm.webhook } } }),
                      });
                      const d = await res.json();
                      if (d.error) throw new Error(d.error.message);
                      setReqStatus("sent");
                    } catch { setReqStatus("error"); }
                  }} disabled={reqStatus === "sending" || !reqForm.email} className="btn-sharp" style={{ padding: "0.5rem 1.25rem", background: "#000", color: "#fff", fontWeight: 700, cursor: reqStatus === "sending" ? "wait" : "pointer" }}>
                    {reqStatus === "sending" ? "Sending..." : "Submit Request"}
                  </button>
                  {reqStatus === "error" && <p style={{ color: "#000", fontSize: "0.8rem", fontWeight: 700 }}>Unable to submit. Please try again.</p>}
                </div>
              )}
            </div>}
          </div>
        </>
      )}
    </div>
  );
}
