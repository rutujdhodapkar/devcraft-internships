import React, { useState, useEffect, useCallback } from "react";
import { notify } from "../services/notify";
import { getFirebaseIdToken } from "../firebase";
import { fetchSiteConfig } from "../services/data";

const TOOLS = [
  { name: "get_domains", desc: "List all internship domains", hint: "{}" },
  { name: "get_tasks", desc: "List projects/tasks for a domain", hint: '{ "domain_id": "ai-ml" }' },
  { name: "lookup", desc: "Query any collection", hint: '{ "collection": "careerPaths" }' },
  { name: "add_domain", desc: "Suggest a new domain (staged proposal)", hint: '{ "id": "my-domain", "title": "My Domain" }' },
  { name: "add_task", desc: "Add a project/task (staged proposal)", hint: '{ "domain_id": "ai-ml", "title": "New Task" }' },
  { name: "remove_domain", desc: "Suggest removing a domain (staged proposal)", hint: '{ "id": "ai-ml" }' },
  { name: "edit_data", desc: "Propose a data edit (staged proposal)", hint: '{ "collection": "careerPaths", "action": "update", "document_id": "ai-ml", "data": {} }' },
  { name: "list_changes", desc: "List pending/approved/rejected proposals", hint: "{}" },
  { name: "collections", desc: "List available data collections", hint: "{}" },
];

const CODE_EXAMPLES = {
  Python: `import requests, json

MCP_URL = "https://devcraft.fennark.xyz/api/mcp-domains"
TOKEN = "YOUR_MCP_TOKEN"

def mcp_call(tool, args=None):
    payload = {
        "jsonrpc": "2.0", "id": 1,
        "method": "tools/call",
        "params": {"name": tool, "arguments": {**(args or {}), "user_token": TOKEN}}
    }
    resp = requests.post(MCP_URL, json=payload)
    return resp.json()

# List all domains
domains = mcp_call("get_domains")
print(domains)

# Look up career paths
data = mcp_call("lookup", {"collection": "careerPaths"})
print(data)`,
  JavaScript: `const MCP_URL = "https://devcraft.fennark.xyz/api/mcp-domains";

async function mcpCall(tool, args = {}) {
  const token = "YOUR_MCP_TOKEN";
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: Date.now(),
      method: "tools/call",
      params: { name: tool, arguments: { ...args, user_token: token } },
    }),
  });
  return res.json();
}

// Get all domains
const domains = await mcpCall("get_domains");
console.log(domains);

// Get tasks for a domain
const tasks = await mcpCall("get_tasks", { domain_id: "ai-ml" });
console.log(tasks);`,
  cURL: `# List all domains
curl -X POST https://devcraft.fennark.xyz/api/mcp-domains \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_domains",
      "arguments": { "user_token": "YOUR_MCP_TOKEN" }
    }
  }'

# Lookup career paths
curl -X POST https://devcraft.fennark.xyz/api/mcp-domains \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "lookup",
      "arguments": {
        "collection": "careerPaths",
        "user_token": "YOUR_MCP_TOKEN"
      }
    }
  }'`,
  Go: `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

const mcpURL = "https://devcraft.fennark.xyz/api/mcp-domains"

func mcpCall(tool string, args map[string]any) (map[string]any, error) {
    token := "YOUR_MCP_TOKEN"
    if args == nil { args = map[string]any{} }
    args["user_token"] = token
    payload := map[string]any{
        "jsonrpc": "2.0", "id": 1,
        "method": "tools/call",
        "params":  map[string]any{"name": tool, "arguments": args},
    }
    body, _ := json.Marshal(payload)
    resp, err := http.Post(mcpURL, "application/json", bytes.NewReader(body))
    if err != nil { return nil, err }
    defer resp.Body.Close()
    var result map[string]any
    json.NewDecoder(resp.Body).Decode(&result)
    return result, nil
}

func main() {
    domains, _ := mcpCall("get_domains", nil)
    fmt.Println(domains)
}`,
};

export default function McpUserDashboard({ user, onClose }) {
  const [tab, setTab] = useState("workspace");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("Checking access…");
  const [approved, setApproved] = useState(false);
  const [details, setDetails] = useState(null);

  const [tool, setTool] = useState("get_domains");
  const [argsText, setArgsText] = useState("{}");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeLang, setCodeLang] = useState("Python");

  // Request access form
  const [reqName, setReqName] = useState(user?.displayName || "");
  const [reqEmail, setReqEmail] = useState(user?.email || "");
  const [reqReason, setReqReason] = useState("");
  const [reqAgencyId, setReqAgencyId] = useState("");
  const [reqWebsiteUrl, setReqWebsiteUrl] = useState("");
  const [reqWebhookUrl, setReqWebhookUrl] = useState("");
  const [reqAllowedTools, setReqAllowedTools] = useState("");
  const [reqRequestedHooks, setReqRequestedHooks] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqDone, setReqDone] = useState(false);

  useEffect(() => { fetchSiteConfig("partnerDetails_mcp").then(setDetails).catch(() => setDetails(null)); }, []);

  const loadToken = useCallback(async () => {
    try { const t = await getFirebaseIdToken(); setToken(t || ""); return t || ""; }
    catch { setToken(""); return ""; }
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
        const msg = typeof data.error === "string" ? data.error : (data.error.message || JSON.stringify(data.error));
        setStatus("Error: " + msg); setApproved(false);
      } else { setStatus("Approved — reads go live, writes become proposals."); setApproved(true); }
    } catch (e) { setStatus("Error: " + e.message); }
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
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: "request_access", arguments: { name: reqName.trim(), email: reqEmail.trim(), reason: reqReason.trim(), agency_id: reqAgencyId.trim() || undefined, website_url: reqWebsiteUrl.trim() || undefined, webhook_url: reqWebhookUrl.trim() || undefined, allowed_tools: reqAllowedTools.trim() || undefined, requested_hooks: reqRequestedHooks.trim() || undefined, user_token: t } } }),
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
      if (data.error) setStatus("Error: " + data.error.message);
      else if (["get_domains", "get_tasks", "lookup", "collections", "list_changes"].includes(tool)) setStatus("Read succeeded.");
      else setStatus("Submitted as a proposal. Admin must approve.");
    } catch (e) { setResult("Error: " + e.message); }
    setBusy(false);
  };

  const copy = async () => {
    if (!token) { notify("No token — refreshing…", "info"); await loadToken(); }
    try { await navigator.clipboard.writeText(token); notify("MCP token copied", "success"); }
    catch (e) { notify("Copy failed: " + e.message, "error"); }
  };

  const handleHtmlClick = (event) => {
    const el = event.target.closest("[data-action], a[href^='#action:']");
    if (!el) return;
    event.preventDefault();
    const href = el.getAttribute("href") || "";
    const action = el.getAttribute("data-action") || href.replace("#action:", "");
    const url = el.getAttribute("data-url") || (href.startsWith("#") ? null : href);
    const key = String(action || "").toLowerCase().replace(/[\s_-]/g, "");
    if (["request", "apply", "requestaccess", "getaccess", "signup", "join"].includes(key)) { setTab("workspace"); return; }
    if (["back", "home", "close", "cancel"].includes(key)) { onClose(); return; }
    if (url) { window.open(url, url.startsWith("http") ? "_blank" : "_self", "noopener"); return; }
    notify("Action not configured.", "info");
  };

  const card = { border: "2px solid #000", padding: "1.25rem", boxShadow: "4px 4px 0 #000", background: "#fff", marginBottom: "1.25rem" };
  const btn = { padding: "0.6rem 1.1rem", fontSize: "0.85rem", fontWeight: 800, cursor: "pointer", border: "2px solid #000", background: "#000", color: "#fff" };
  const input = { width: "100%", boxSizing: "border-box", border: "2px solid #000", padding: "0.6rem", fontSize: "0.85rem", marginBottom: "0.6rem" };
  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} style={{ padding: "0.5rem 1rem", fontSize: "0.82rem", fontWeight: tab === id ? 900 : 700, textTransform: "uppercase", border: "2px solid #000", background: tab === id ? "#000" : "#fff", color: tab === id ? "#fff" : "#000", cursor: "pointer" }}>{label}</button>
  );

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

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        {tabBtn("workspace", approved ? "Workspace" : "Request Access")}
        {tabBtn("docs", "Documentation")}
        {tabBtn("examples", "Code Examples")}
        {tabBtn("tools", "Tools Reference")}
        {tabBtn("how-it-works", "How It Works")}
      </div>

      {tab === "workspace" && !approved && !status.includes("Checking") && (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>Request MCP Access</h2>
          {reqDone ? (
            <p style={{ fontSize: "0.9rem" }}>Your request has been submitted. An admin will review and approve it. Check back later.</p>
          ) : (
            <>
              <p style={{ fontSize: "0.85rem", marginTop: 0, lineHeight: 1.5 }}>Your email is not yet approved for MCP access. Submit a request below and an admin will review it.</p>
              <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.2rem" }}>Name *</label>
              <input type="text" value={reqName} onChange={(e) => setReqName(e.target.value)} style={input} />
              <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.2rem" }}>Email *</label>
              <input type="email" value={reqEmail} readOnly style={{ ...input, background: "#f0f0f0" }} />
              <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.2rem" }}>Reason for access *</label>
              <textarea rows={3} value={reqReason} onChange={(e) => setReqReason(e.target.value)} placeholder="Why do you need MCP access?" style={{ ...input, resize: "vertical" }} />
              <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.2rem" }}>Agency ID (optional)</label>
              <input type="text" value={reqAgencyId} onChange={(e) => setReqAgencyId(e.target.value)} placeholder="e.g. agency-123" style={input} />
              <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.2rem" }}>Website URL (optional)</label>
              <input type="url" value={reqWebsiteUrl} onChange={(e) => setReqWebsiteUrl(e.target.value)} placeholder="https://my-website.com" style={input} />
              <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.2rem" }}>Webhook URL (optional)</label>
              <input type="url" value={reqWebhookUrl} onChange={(e) => setReqWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhook" style={input} />
              <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.2rem" }}>Requested Tools (optional, comma-separated)</label>
              <input type="text" value={reqAllowedTools} onChange={(e) => setReqAllowedTools(e.target.value)} placeholder="e.g. get_domains, lookup" style={input} />
              <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.2rem" }}>Requested Hooks / APIs (optional, comma-separated)</label>
              <input type="text" value={reqRequestedHooks} onChange={(e) => setReqRequestedHooks(e.target.value)} placeholder="e.g. webhook, slack" style={input} />
              <button onClick={requestAccess} disabled={reqBusy} style={{ ...btn, opacity: reqBusy ? 0.6 : 1, marginTop: "0.4rem" }}>{reqBusy ? "Submitting…" : "Submit request"}</button>
            </>
          )}
        </section>
      )}

      {tab === "workspace" && approved && (
        <>
          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>Your MCP Token</h2>
            <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>Use as <code>user_token</code> or <code>Authorization: Bearer</code> when calling <code>/api/mcp-domains</code>.</p>
            <textarea readOnly value={token} rows={4} style={{ width: "100%", boxSizing: "border-box", border: "2px solid #000", padding: "0.6rem", fontFamily: "monospace", fontSize: "0.72rem", resize: "vertical" }} />
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
              <button onClick={copy} style={btn}>Copy token</button>
              <button onClick={() => loadToken().then(() => notify("Refreshed", "success"))} style={{ ...btn, background: "#fff", color: "#000" }}>Refresh token</button>
            </div>
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>Try a tool</h2>
            <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>Reads run live. Writes become proposals and go live after admin approval.</p>
            <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.3rem" }}>Tool</label>
            <select value={tool} onChange={(e) => { setTool(e.target.value); const t = TOOLS.find((x) => x.name === e.target.value); setArgsText(t ? t.hint : "{}"); }} style={{ width: "100%", boxSizing: "border-box", border: "2px solid #000", padding: "0.6rem", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              {TOOLS.map((t) => <option key={t.name} value={t.name}>{t.name} — {t.desc}</option>)}
            </select>
            <label style={{ fontSize: "0.75rem", fontWeight: 800, display: "block", marginBottom: "0.3rem" }}>Arguments (JSON)</label>
            <textarea value={argsText} onChange={(e) => setArgsText(e.target.value)} rows={4} style={{ width: "100%", boxSizing: "border-box", border: "2px solid #000", padding: "0.6rem", fontFamily: "monospace", fontSize: "0.78rem", resize: "vertical" }} />
            <div style={{ marginTop: "0.75rem" }}><button onClick={run} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>{busy ? "Running…" : "Run tool"}</button></div>
            {result && <pre style={{ marginTop: "1rem", background: "#f5f5f5", border: "1px solid #ddd", padding: "0.75rem", fontSize: "0.75rem", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "320px", overflow: "auto" }}>{result}</pre>}
          </section>
        </>
      )}

      {tab === "docs" && (
        <section style={card} onClick={handleHtmlClick}>
          <h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>Documentation</h2>
          {details?.html ? (
            <div className="mcp-docs-html" dangerouslySetInnerHTML={{ __html: details.html }} />
          ) : (
            <div>
              <p style={{ color: "#666", lineHeight: 1.6 }}>
                The MCP API lets you read internship domains, browse tasks, query data, and submit proposals — all through a single HTTP endpoint.
              </p>
              <h3>Quick Start</h3>
              <ol style={{ lineHeight: 2 }}>
                <li><strong>Get your token</strong> — open the Workspace tab and copy your MCP token.</li>
                <li><strong>Call the endpoint</strong> — POST to <code>/api/mcp-domains</code> with your token as <code>user_token</code> or <code>Authorization: Bearer</code>.</li>
                <li><strong>Start with <code>get_domains</code></strong> — returns all available internship domains.</li>
                <li><strong>Explore <code>lookup</code></strong> — query collections like <code>careerPaths</code>, <code>enrollments</code>, etc.</li>
                <li><strong>Submit proposals</strong> — use <code>add_domain</code>, <code>add_task</code>, <code>edit_data</code> — these are staged and reviewed by an admin.</li>
              </ol>
              <p style={{ color: "#888", fontStyle: "italic", marginTop: "1rem" }}>Admins can edit this documentation in Admin Panel → MCP & API → Public details & actions.</p>
            </div>
          )}
          {details?.features && <div style={{ marginTop: "1rem" }}><h3>Features</h3><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{details.features}</p></div>}
          {details?.resources && <div style={{ marginTop: "1rem" }}><h3>Resources</h3><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{details.resources}</p></div>}
          {details?.requirements && <div style={{ marginTop: "1rem" }}><h3>Requirements</h3><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{details.requirements}</p></div>}
          {details?.faq && <div style={{ marginTop: "1rem" }}><h3>FAQ</h3><p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{details.faq}</p></div>}
          {details?.actions?.filter(a => a.enabled !== false).length > 0 && (
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
              {details.actions.filter(a => a.enabled !== false).map((action, i) => (
                <button key={i} type="button" className="btn-sharp" data-action={action.action || "request"} data-url={action.url || ""} onClick={handleHtmlClick} style={{ padding: "0.6rem 1.2rem", fontSize: "0.85rem", fontWeight: 800, border: "2px solid #000", background: "#000", color: "#fff", cursor: "pointer" }}>{action.label}</button>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "examples" && (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>Code Examples</h2>
          <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>Use your MCP token to call the API from any language. Replace <code>YOUR_MCP_TOKEN</code> with your actual token.</p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            {Object.keys(CODE_EXAMPLES).map(lang => (
              <button key={lang} onClick={() => setCodeLang(lang)} style={{ padding: "0.35rem 0.85rem", fontSize: "0.78rem", fontWeight: codeLang === lang ? 900 : 700, border: "2px solid #000", background: codeLang === lang ? "#000" : "#fff", color: codeLang === lang ? "#fff" : "#000", cursor: "pointer" }}>{lang}</button>
            ))}
          </div>
          <pre style={{ background: "#1e1e1e", color: "#d4d4d4", padding: "1rem", fontSize: "0.78rem", lineHeight: 1.5, overflow: "auto", maxHeight: "400px", whiteSpace: "pre-wrap", wordBreak: "break-word", borderRadius: "4px" }}><code>{CODE_EXAMPLES[codeLang]}</code></pre>
        </section>
      )}

      {tab === "tools" && (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>Tools Reference</h2>
          <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>All available MCP tools. Reads execute live; writes are staged as proposals for admin review.</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead><tr style={{ background: "#000", color: "#fff" }}>
                <th style={{ border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>Tool</th>
                <th style={{ border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>Type</th>
                <th style={{ border: "1px solid #000", padding: "0.5rem", textAlign: "left" }}>Description</th>
              </tr></thead>
              <tbody>
                <tr style={{ background: "#f0fff0" }}><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem", fontWeight: 700 }}>get_domains</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Read</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>List all internship domains/career paths</td></tr>
                <tr style={{ background: "#f0fff0" }}><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem", fontWeight: 700 }}>get_tasks</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Read</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>List projects/tasks for a specific domain</td></tr>
                <tr style={{ background: "#f0fff0" }}><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem", fontWeight: 700 }}>lookup</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Read</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Query any data collection with filters</td></tr>
                <tr style={{ background: "#f0fff0" }}><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem", fontWeight: 700 }}>collections</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Read</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>List available collections (careerPaths, enrollments, etc.)</td></tr>
                <tr style={{ background: "#f0fff0" }}><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem", fontWeight: 700 }}>list_changes</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Read</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>View your pending/approved/rejected proposals</td></tr>
                <tr style={{ background: "#fff8e1" }}><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem", fontWeight: 700 }}>add_domain</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Write (proposal)</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Suggest adding a new domain — goes to admin for review</td></tr>
                <tr style={{ background: "#fff8e1" }}><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem", fontWeight: 700 }}>add_task</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Write (proposal)</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Suggest adding a project/quiz to a domain</td></tr>
                <tr style={{ background: "#fff8e1" }}><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem", fontWeight: 700 }}>remove_domain</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Write (proposal)</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Suggest removing a domain</td></tr>
                <tr style={{ background: "#fff8e1" }}><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem", fontWeight: 700 }}>edit_data</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Write (proposal)</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Propose creating, updating, or deleting a data document</td></tr>
                <tr style={{ background: "#f0e6ff" }}><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem", fontWeight: 700 }}>request_access</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Self-service</td><td style={{ border: "1px solid #ccc", padding: "0.4rem 0.6rem" }}>Request MCP access (available to any signed-in user)</td></tr>
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#888", marginTop: "1rem" }}>Admin-only tools: <code>approve_user</code>, <code>remove_user</code>, <code>pending_users</code>, <code>active_users</code>, <code>approve_change</code>, <code>reject_change</code>, <code>audit_log</code></p>
        </section>
      )}

      {tab === "how-it-works" && (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>How It Works</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ borderLeft: "4px solid #000", paddingLeft: "1rem" }}>
              <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>1. Authentication</h3>
              <p style={{ margin: 0, color: "#555", lineHeight: 1.6 }}>Sign in with Google. Your Firebase ID token becomes your MCP credential. Pass it as <code>user_token</code> in tool arguments or as <code>Authorization: Bearer</code> in the HTTP header.</p>
            </div>
            <div style={{ borderLeft: "4px solid #000", paddingLeft: "1rem" }}>
              <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>2. Access Control</h3>
              <p style={{ margin: 0, color: "#555", lineHeight: 1.6 }}>New users must submit an access request. An admin reviews and grants access with specific tool permissions. Admins can also edit all data directly and approve proposals.</p>
            </div>
            <div style={{ borderLeft: "4px solid #000", paddingLeft: "1rem" }}>
              <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>3. Reads vs Writes</h3>
              <p style={{ margin: 0, color: "#555", lineHeight: 1.6 }}><strong>Read tools</strong> (<code>get_domains</code>, <code>get_tasks</code>, <code>lookup</code>, etc.) execute immediately and return live data. <strong>Write tools</strong> (<code>add_domain</code>, <code>add_task</code>, <code>remove_domain</code>, <code>edit_data</code>) create proposals that only an admin can approve or reject.</p>
            </div>
            <div style={{ borderLeft: "4px solid #000", paddingLeft: "1rem" }}>
              <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>4. Proposal Workflow</h3>
              <p style={{ margin: 0, color: "#555", lineHeight: 1.6 }}>Submitted proposals appear in the Admin Panel under "Proposals". The admin reviews each one and can approve or reject it. Approved proposals go live immediately. Use <code>list_changes</code> to track your proposals.</p>
            </div>
            <div style={{ borderLeft: "4px solid #000", paddingLeft: "1rem" }}>
              <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>5. Caching</h3>
              <p style={{ margin: 0, color: "#555", lineHeight: 1.6 }}>Query results are cached in memory for 30 seconds to improve performance. After a successful write or proposal approval, the cache is cleared automatically so the next read returns fresh data.</p>
            </div>
            <div style={{ borderLeft: "4px solid #000", paddingLeft: "1rem" }}>
              <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>6. Audit Trail</h3>
              <p style={{ margin: 0, color: "#555", lineHeight: 1.6 }}>Every tool call, access request, and admin action is logged. Admins can view the full audit trail in the Admin Panel under MCP Logs.</p>
            </div>
          </div>
          <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "4px" }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>JSON-RPC Protocol</h3>
            <p style={{ margin: 0, color: "#555", fontSize: "0.82rem", lineHeight: 1.6 }}>The MCP API uses <a href="https://www.jsonrpc.org/specification" target="_blank" rel="noopener">JSON-RPC 2.0</a>. Every request has <code>jsonrpc: "2.0"</code>, an <code>id</code>, <code>method: "tools/call"</code>, and <code>params</code> containing the tool <code>name</code> and <code>arguments</code> (including your <code>user_token</code>).</p>
          </div>
        </section>
      )}
    </main>
  );
}
