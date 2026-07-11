import React, { useState, useEffect, useCallback } from "react";
import { notify } from "../services/notify";
import { getFirebaseIdToken } from "../firebase";

const TOOLS = [
  { name: "get_domains", desc: "List all domains (read, live)", hint: "{}" },
  { name: "get_tasks", desc: "List tasks for a domain (read, live)", hint: '{ "domain_id": "ai-ml" }' },
  { name: "lookup", desc: "Query any collection (read, live)", hint: '{ "collection": "careerPaths" }' },
  { name: "add_domain", desc: "Suggest a new domain (staged proposal)", hint: '{ "id": "my-domain", "title": "My Domain" }' },
  { name: "add_task", desc: "Suggest a task (staged proposal)", hint: '{ "domain_id": "ai-ml", "title": "New Task" }' },
  { name: "remove_domain", desc: "Suggest removing a domain (staged proposal)", hint: '{ "id": "ai-ml" }' },
  { name: "edit_data", desc: "Propose a data edit (staged proposal)", hint: '{ "collection": "careerPaths", "action": "update", "document_id": "ai-ml", "data": {} }' },
];

export default function McpUserDashboard({ user, onClose }) {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Checking access…");
  const [approved, setApproved] = useState(false);

  const [tool, setTool] = useState("get_domains");
  const [argsText, setArgsText] = useState("{}");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  // Request access form
  const [reqName, setReqName] = useState(user?.displayName || "");
  const [reqReason, setReqReason] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqDone, setReqDone] = useState(false);

  const loadToken = useCallback(async () => {
    try {
      const t = await getFirebaseIdToken();
      setToken(t || "");
      return t;
    } catch {
      setToken("");
      return "";
    }
  }, []);

  useEffect(() => { loadToken(); }, [loadToken]);

  const checkAccess = useCallback(async () => {
    const t = token || (await loadToken());
    if (!t) { setStatus("Not signed in."); return; }
    try {
      const res = await fetch("/api/mcp-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_domains", arguments: { user_token: t } } }),
      });
      const data = await res.json();
      if (data.error) {
        setStatus("❌ " + data.error.message);
        setApproved(false);
      } else {
        setStatus("✅ Approved — you can read data and submit updates (proposals).");
        setApproved(true);
      }
    } catch (e) {
      setStatus("Error: " + e.message);
    }
  }, [token, loadToken]);

  useEffect(() => { if (token) checkAccess(); }, [token, checkAccess]);

  const requestAccess = async () => {
    const t = await loadToken();
    if (!t) { notify("Sign in first.", "error"); return; }
    if (!reqReason.trim()) { notify("Tell us why you need access.", "warning"); return; }
    setReqBusy(true);
    try {
      const res = await fetch("/api/mcp-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: "request_access", arguments: { name: reqName.trim(), reason: reqReason.trim(), user_token: t } } }),
      });
      const data = await res.json();
      if (data.error) { notify("Error: " + (data.error.message || JSON.stringify(data.error)), "error"); return; }
      notify("Access request submitted. Admin will review.", "success");
      setReqDone(true);
    } catch (e) { notify("Request failed: " + e.message, "error"); }
    setReqBusy(false);
  };

  const run = async () => {
    setBusy(true); setResult("");
    const t = token || (await loadToken());
    if (!t) { setResult("Sign in first."); setBusy(false); return; }
    let args = {};
    try { args = argsText && argsText.trim() ? JSON.parse(argsText) : {}; }
    catch (e) { setResult("Invalid JSON args: " + e.message); setBusy(false); return; }
    try {
      const res = await fetch("/api/mcp-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: tool, arguments: { ...args, user_token: t } } }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
      if (data.error) setStatus("❌ " + data.error.message);
      else if (tool === "get_domains" || tool === "get_tasks" || tool === "lookup") setStatus("✅ Approved — read succeeded.");
      else setStatus("📝 Submitted as a proposal. Admin must approve before it goes live.");
    } catch (e) { setResult("Error: " + e.message); }
    setBusy(false);
  };

  const copy = async () => {
    if (!token) { notify("No token yet — refreshing…", "info"); await loadToken(); }
    try { await navigator.clipboard.writeText(token); notify("MCP token copied to clipboard", "success"); }
    catch (e) { notify("Copy failed: " + e.message, "error"); }
  };

  const card = { border: "2px solid #000", padding: "1.25rem", boxShadow: "4px 4px 0 #000", background: "#fff", marginBottom: "1.25rem" };
  const btn = { padding: "0.6rem 1.1rem", fontSize: "0.85rem", fontWeight: 800, cursor: "pointer", border: "2px solid #000", background: "#000", color: "#fff" };
  const input = { width: "100%", boxSizing: "border-box", border: "2px solid #000", padding: "0.6rem", fontSize: "0.85rem", marginBottom: "0.6rem" };

  return (
    <main style={{ maxWidth: "960px", margin: "0 auto", padding: "6rem 1.25rem 3rem" }}>
      <header style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 900, letterSpacing: "2px", textTransform: "uppercase" }}>DEV/CRAFT · MCP &amp; API</div>
          <h1 style={{ margin: "0.25rem 0", fontSize: "1.5rem", textTransform: "uppercase" }}>MCP Workspace</h1>
          <p style={{ margin: 0, opacity: 0.8, fontSize: "0.85rem" }}>{status}</p>
        </div>
        {onClose && <button onClick={onClose} style={{ ...btn, background: "#fff", color: "#000" }}>Back</button>}
      </header>

      {!approved && !status.includes("Checking") && (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>Request MCP Access</h2>
          {reqDone ? (
            <p style={{ fontSize: "0.9rem" }}>Your request has been submitted. An admin will review and approve it. Check back later.</p>
          ) : (
            <>
              <p style={{ fontSize: "0.85rem", marginTop: 0, lineHeight: 1.5 }}>
                Your email is not yet approved for MCP access. Submit a request below and an admin will review it.
              </p>
              <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.2rem" }}>Name</label>
              <input type="text" value={reqName} onChange={(e) => setReqName(e.target.value)} style={input} />
              <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.2rem" }}>Reason for access</label>
              <textarea rows={3} value={reqReason} onChange={(e) => setReqReason(e.target.value)} placeholder="Why do you need MCP access? What tools will you use?" style={{ ...input, resize: "vertical" }} />
              <button onClick={requestAccess} disabled={reqBusy} style={{ ...btn, opacity: reqBusy ? 0.6 : 1 }}>{reqBusy ? "Submitting…" : "Submit request"}</button>
            </>
          )}
        </section>
      )}

      {approved && (
        <>
          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>Your MCP Token</h2>
            <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>
              Use this token as <code>user_token</code> / <code>Authorization: Bearer</code> when calling <code>/api/mcp-domains</code>.
            </p>
            <textarea readOnly value={token} rows={4} style={{ width: "100%", boxSizing: "border-box", border: "2px solid #000", padding: "0.6rem", fontFamily: "monospace", fontSize: "0.72rem", resize: "vertical" }} />
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
              <button onClick={copy} style={btn}>Copy token</button>
              <button onClick={() => loadToken().then(() => notify("Token refreshed", "success"))} style={{ ...btn, background: "#fff", color: "#000" }}>Refresh token</button>
            </div>
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>Try a tool</h2>
            <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>
              Reads run live. Writes (<code>add_domain</code>, <code>add_task</code>, <code>remove_domain</code>, <code>edit_data</code>) are staged as proposals and go live only after an admin approves them.
            </p>
            <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.3rem" }}>Tool</label>
            <select value={tool} onChange={(e) => { setTool(e.target.value); const t = TOOLS.find((x) => x.name === e.target.value); setArgsText(t ? t.hint : "{}"); }} style={{ width: "100%", boxSizing: "border-box", border: "2px solid #000", padding: "0.6rem", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              {TOOLS.map((t) => <option key={t.name} value={t.name}>{t.name} — {t.desc}</option>)}
            </select>
            <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.3rem" }}>Arguments (JSON)</label>
            <textarea value={argsText} onChange={(e) => setArgsText(e.target.value)} rows={4} style={{ width: "100%", boxSizing: "border-box", border: "2px solid #000", padding: "0.6rem", fontFamily: "monospace", fontSize: "0.78rem", resize: "vertical" }} />
            <div style={{ marginTop: "0.75rem" }}>
              <button onClick={run} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? "Running…" : "Run tool"}</button>
            </div>
            {result && (
              <pre style={{ marginTop: "1rem", background: "#f5f5f5", border: "1px solid #ddd", padding: "0.75rem", fontSize: "0.75rem", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "320px", overflow: "auto" }}>{result}</pre>
            )}
          </section>
        </>
      )}
    </main>
  );
}
