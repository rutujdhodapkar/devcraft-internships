import React, { useEffect, useState } from "react";
import {
  addAgencyAdminEmail,
  deleteAgencyTemplate,
  deletePartnerCourse,
  fetchAgencyTemplates,
  fetchAgencyEnrollments,
  fetchPartnerAccounts,
  fetchPartnerAudit,
  fetchPartnerCourses,
  logPartnerAudit,
  removeAgencyAdminEmail,
  saveAgency,
  saveAgencyTemplate,
  savePartnerCourse,
} from "../services/data";
import { notify } from "../services/notify";

const input = { width: "100%", boxSizing: "border-box", border: "2px solid #000", padding: "0.6rem 0.75rem", fontFamily: "inherit", fontSize: "0.85rem" };
const card = { border: "2px solid #000", padding: "1.25rem", boxShadow: "4px 4px 0 #000", background: "#fff" };

export default function PartnerPortal({ type, title, subtitle, onClose, user }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [application, setApplication] = useState({ name: "", website: "", description: "", contactName: "", contactPhone: "", contactEmail: "", organizationType: "", designation: "", reason: "", requestedHooks: "" });
  const [courses, setCourses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [courseForm, setCourseForm] = useState({ title: "", duration: "", description: "" });
  const [templateForm, setTemplateForm] = useState({ name: "", content: "" });
  const [newAdmin, setNewAdmin] = useState("");
  const email = (user?.email || "").toLowerCase().trim();
  const isOwner = account?.ownerEmail?.toLowerCase() === email;

  const load = async () => {
    setLoading(true);
    try {
      const accounts = await fetchPartnerAccounts(type);
      const mine = accounts.find((item) => (item.emails || []).some((member) => member.toLowerCase() === email));
      setAccount(mine || null);
      if (mine?.approved) {
        const [savedCourses, savedTemplates, savedEnrollments, savedAudit] = await Promise.all([fetchPartnerCourses(mine.id), fetchAgencyTemplates(mine.id), fetchAgencyEnrollments(mine.id), fetchPartnerAudit(mine.id)]);
        setCourses(savedCourses);
        setTemplates(savedTemplates);
        setEnrollments(savedEnrollments);
        setAuditEvents(savedAudit);
      }
    } catch { notify("Could not load your partner workspace.", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (email) load(); else setLoading(false); }, [email, type]);

  const apply = async (event) => {
    event.preventDefault();
    if (!email || !application.name.trim()) return;
    await saveAgency({ ...application, contactEmail: email, partnerType: type, emails: [email], ownerEmail: email, memberRoles: { [email]: "owner" }, subscriptionPlan: "Starter", subscriptionStatus: "trial", approved: false });
    notify("Application submitted for admin approval.", "success");
    load();
  };

  const addCourse = async (event) => {
    event.preventDefault();
    if (!courseForm.title.trim()) return;
    await savePartnerCourse({ ...courseForm, partnerId: account.id });
    await logPartnerAudit(account.id, email, "created item", courseForm.title);
    setCourseForm({ title: "", duration: "", description: "" });
    setCourses(await fetchPartnerCourses(account.id));
  };

  const addTemplate = async (event) => {
    event.preventDefault();
    if (!templateForm.name.trim()) return;
    await saveAgencyTemplate({ ...templateForm, agencyId: account.id, type });
    await logPartnerAudit(account.id, email, "created template", templateForm.name);
    setTemplateForm({ name: "", content: "" });
    setTemplates(await fetchAgencyTemplates(account.id));
  };

  const addAdmin = async (event) => {
    event.preventDefault();
    if (!newAdmin.trim() || !isOwner) return;
    await addAgencyAdminEmail(account.id, newAdmin.toLowerCase().trim());
    await logPartnerAudit(account.id, email, "invited administrator", newAdmin.toLowerCase().trim());
    setNewAdmin("");
    await load();
  };

  const tabButton = (id, label) => <button type="button" onClick={() => setTab(id)} style={{ padding: "0.45rem 0.85rem", border: "2px solid #000", background: tab === id ? "#000" : "#fff", color: tab === id ? "#fff" : "#000", fontWeight: 800, cursor: "pointer", fontSize: "0.8rem" }}>{label}</button>;
  const activeLearners = enrollments.filter((item) => item.status !== "Completed" && item.status !== "Archived").length;
  const completedLearners = enrollments.filter((item) => item.status === "Completed").length;
  const atRiskLearners = enrollments.filter((item) => item.status !== "Completed" && (!item.submissions || Object.keys(item.submissions).length === 0)).length;
  const completionRate = enrollments.length ? Math.round((completedLearners / enrollments.length) * 100) : 0;

  if (!user) return <main style={{ maxWidth: "960px", margin: "0 auto", padding: "7rem 1.5rem 2rem" }}><header style={{ background: "#000", color: "#fff", padding: "2rem", marginBottom: "1.5rem" }}><div style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "1px" }}>DEV/CRAFT PARTNERS</div><h1 style={{ margin: "0.5rem 0", textTransform: "uppercase" }}>{title}</h1><p style={{ maxWidth: "650px", lineHeight: 1.6, opacity: 0.85 }}>{subtitle} Approved partners receive a dedicated workspace, role-based access, progress reporting, templates, and a direct support path.</p></header><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}><div style={card}><strong>What you can manage</strong><p>Programs, domains, templates, learners, team roles, and activity history.</p></div><div style={card}><strong>Approval process</strong><p>Provide your organization and contact details, then DEV/CRAFT reviews and enables only the access your team needs.</p></div><div style={card}><strong>Ready to start?</strong><p>Sign in with your work email to submit a request.</p><button className="btn-sharp" onClick={onClose}>Back to home</button></div></div></main>;
  if (loading) return <main style={{ padding: "7rem 1.5rem", textAlign: "center" }}>Loading workspace…</main>;

  if (!account) return <main style={{ maxWidth: "760px", margin: "0 auto", padding: "7rem 1.5rem 2rem" }}><header style={{ background: "#000", color: "#fff", padding: "1.5rem", marginBottom: "1.5rem" }}><h1 style={{ margin: 0, textTransform: "uppercase", fontSize: "1.35rem" }}>{title}</h1><p style={{ margin: "0.35rem 0 0", opacity: 0.8 }}>{subtitle}</p></header><form onSubmit={apply} style={card}><h2 style={{ marginTop: 0, fontSize: "1rem", textTransform: "uppercase" }}>Request access</h2><p style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>All fields are mandatory and reviewed by DEV/CRAFT admin before approval.</p><label>Organization / university name<input required value={application.name} onChange={(e) => setApplication({ ...application, name: e.target.value })} style={input} /></label><label>Organization type<select required value={application.organizationType} onChange={(e) => setApplication({ ...application, organizationType: e.target.value })} style={input}><option value="">Select type</option><option>University</option><option>College</option><option>Training organization</option><option>Company</option><option>Other</option></select></label><label>Contact person name<input required value={application.contactName} onChange={(e) => setApplication({ ...application, contactName: e.target.value })} style={input} /></label><label>Designation<input required value={application.designation} onChange={(e) => setApplication({ ...application, designation: e.target.value })} style={input} /></label><label>Contact email<input required type="email" value={email} readOnly style={{ ...input, background: "#f2f2f2" }} /></label><label>Contact phone<input required type="tel" value={application.contactPhone} onChange={(e) => setApplication({ ...application, contactPhone: e.target.value })} style={input} /></label><label>Website / URL<input required type="url" value={application.website} onChange={(e) => setApplication({ ...application, website: e.target.value })} style={input} /></label>{type === "mcp" && <label>Requested hooks / APIs<textarea required rows={3} placeholder="e.g. get_domains, get_tasks, webhook events" value={application.requestedHooks} onChange={(e) => setApplication({ ...application, requestedHooks: e.target.value })} style={{ ...input, resize: "vertical" }} /></label>}<label>Reason for request<textarea required rows={3} value={application.reason} onChange={(e) => setApplication({ ...application, reason: e.target.value })} style={{ ...input, resize: "vertical" }} /></label><label>Program or integration requirements<textarea required rows={4} value={application.description} onChange={(e) => setApplication({ ...application, description: e.target.value })} style={{ ...input, resize: "vertical" }} /></label><button className="btn-sharp" type="submit" style={{ marginTop: "1rem" }}>Submit request</button></form></main>;
  if (!account.approved) return <main style={{ maxWidth: "760px", margin: "0 auto", padding: "7rem 1.5rem 2rem" }}><div style={card}><h1 style={{ marginTop: 0 }}>Application pending</h1><p>Your {title.toLowerCase()} workspace for <strong>{account.name}</strong> is awaiting admin approval. We will enable the dashboard once it is approved.</p><button className="btn-sharp" onClick={onClose}>Back</button></div></main>;

  return <main style={{ maxWidth: "1080px", margin: "0 auto", padding: "6.5rem 1.5rem 2rem" }}>
    <header style={{ background: "#000", color: "#fff", padding: "1.5rem", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}><div><div style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "1px" }}>APPROVED PARTNER WORKSPACE</div><h1 style={{ margin: "0.25rem 0", fontSize: "1.5rem", textTransform: "uppercase" }}>{account.name}</h1><p style={{ margin: 0, opacity: 0.8, fontSize: "0.85rem" }}>{subtitle}</p></div><button onClick={onClose} style={{ border: "2px solid #fff", background: "#fff", color: "#000", padding: "0.5rem 0.9rem", fontWeight: 800, cursor: "pointer" }}>Back</button></header>
    <nav aria-label="Workspace sections" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>{tabButton("overview", "Overview")}{tabButton("analytics", "Analytics")}{tabButton("courses", type === "university" ? "Courses" : "Integrations")}{tabButton("templates", "Templates")}{tabButton("team", "Team")}{tabButton("activity", "Activity")}{tabButton("billing", "Plan")}</nav>
    {tab === "overview" && <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}><div><strong>Workspace owner</strong><p>{account.ownerEmail}</p></div><div><strong>{type === "university" ? "Courses" : "Integration records"}</strong><p>{courses.length} active items</p></div><div><strong>Templates</strong><p>{templates.length} saved templates</p></div><div><strong>Team admins</strong><p>{(account.emails || []).length} members</p></div></div>}
    {tab === "analytics" && <section><div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}><div><strong>Enrolled</strong><p style={{ fontSize: "2rem", margin: "0.4rem 0" }}>{enrollments.length}</p></div><div><strong>Active</strong><p style={{ fontSize: "2rem", margin: "0.4rem 0" }}>{activeLearners}</p></div><div><strong>Completion rate</strong><p style={{ fontSize: "2rem", margin: "0.4rem 0" }}>{completionRate}%</p></div><div><strong>At risk</strong><p style={{ fontSize: "2rem", margin: "0.4rem 0" }}>{atRiskLearners}</p></div></div><p style={{ fontSize: "0.82rem", marginTop: "1rem" }}>At-risk learners have an active enrollment with no submitted task. Use this as a follow-up queue; completion rate is completed enrollments divided by all enrolled learners.</p></section>}
    {tab === "courses" && <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)", gap: "1.25rem" }}><div style={card}><h2 style={{ marginTop: 0, fontSize: "1rem" }}>{type === "university" ? "Courses and programs" : "Integration catalogue"}</h2>{courses.length ? courses.map((course) => <article key={course.id} style={{ borderTop: "1px solid #000", padding: "0.85rem 0" }}><strong>{course.title}</strong><span style={{ marginLeft: "0.75rem", fontSize: "0.75rem" }}>{course.duration}</span><p style={{ margin: "0.35rem 0" }}>{course.description}</p><button onClick={async () => { await deletePartnerCourse(course.id); setCourses(await fetchPartnerCourses(account.id)); }} style={{ border: "0", background: "#000", color: "#fff", padding: "0.3rem 0.6rem", cursor: "pointer" }}>Remove</button></article>) : <p>No items yet.</p>}</div><form onSubmit={addCourse} style={card}><h2 style={{ marginTop: 0, fontSize: "1rem" }}>Add {type === "university" ? "course" : "integration"}</h2><input required placeholder="Title" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} style={input} /><input placeholder="Duration / status" value={courseForm.duration} onChange={(e) => setCourseForm({ ...courseForm, duration: e.target.value })} style={input} /><textarea placeholder="Description" rows={4} value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} style={{ ...input, resize: "vertical" }} /><button className="btn-sharp" type="submit" style={{ marginTop: "0.75rem" }}>Save item</button></form></section>}
    {tab === "templates" && <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)", gap: "1.25rem" }}><div style={card}><h2 style={{ marginTop: 0, fontSize: "1rem" }}>Reusable templates</h2>{templates.length ? templates.map((template) => <article key={template.id} style={{ borderTop: "1px solid #000", padding: "0.85rem 0" }}><strong>{template.name}</strong><pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.85rem" }}>{template.content}</pre><button onClick={async () => { await deleteAgencyTemplate(template.id); setTemplates(await fetchAgencyTemplates(account.id)); }} style={{ border: "0", background: "#000", color: "#fff", padding: "0.3rem 0.6rem", cursor: "pointer" }}>Remove</button></article>) : <p>Create a template for briefs, onboarding, or project standards.</p>}</div><form onSubmit={addTemplate} style={card}><h2 style={{ marginTop: 0, fontSize: "1rem" }}>New template</h2><input required placeholder="Template name" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} style={input} /><textarea required placeholder="Template content" rows={7} value={templateForm.content} onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} style={{ ...input, resize: "vertical" }} /><button className="btn-sharp" type="submit" style={{ marginTop: "0.75rem" }}>Save template</button></form></section>}
    {tab === "team" && <section style={card}><h2 style={{ marginTop: 0, fontSize: "1rem" }}>Workspace team</h2><p style={{ fontSize: "0.85rem" }}>Only the main contact can invite or remove administrators for this workspace.</p>{(account.emails || []).map((member) => <div key={member} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #000", padding: "0.75rem 0" }}><span>{member} <small>({account.memberRoles?.[member] || (member === account.ownerEmail ? "owner" : "admin")})</small></span>{isOwner && member !== account.ownerEmail && <button onClick={async () => { await removeAgencyAdminEmail(account.id, member); load(); }} style={{ border: "0", background: "#000", color: "#fff", cursor: "pointer" }}>Remove</button>}</div>)}{isOwner && <form onSubmit={addAdmin} style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", maxWidth: "520px" }}><input type="email" required placeholder="new-admin@example.com" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)} style={input} /><button className="btn-sharp" type="submit">Invite admin</button></form>}</section>}
    {tab === "activity" && <section style={card}><h2 style={{ marginTop: 0, fontSize: "1rem" }}>Workspace activity</h2>{auditEvents.length ? auditEvents.map((event) => <div key={event.id} style={{ borderTop: "1px solid #000", padding: "0.7rem 0", fontSize: "0.85rem" }}><strong>{event.action}</strong>{event.detail && ` — ${event.detail}`}<div style={{ fontSize: "0.72rem", marginTop: "0.2rem" }}>{event.actor} · {new Date(event.createdAt).toLocaleString()}</div></div>) : <p>No workspace activity has been recorded yet.</p>}</section>}
    {tab === "billing" && <section style={card}><h2 style={{ marginTop: 0, fontSize: "1rem" }}>Subscription-ready workspace</h2><p>Your current plan is <strong>{account.subscriptionPlan || "Starter"}</strong> ({account.subscriptionStatus || "trial"}).</p>{isOwner && <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{["Starter", "Growth", "Enterprise"].map((plan) => <button key={plan} onClick={async () => { const updated = { ...account, subscriptionPlan: plan, subscriptionStatus: plan === "Starter" ? "trial" : "requested" }; await saveAgency(updated); setAccount(updated); notify(`${plan} plan selected. Our team will review the request.`, "success"); }} style={{ border: "2px solid #000", background: account.subscriptionPlan === plan ? "#000" : "#fff", color: account.subscriptionPlan === plan ? "#fff" : "#000", padding: "0.5rem 0.8rem", cursor: "pointer", fontWeight: 800 }}>{plan}</button>)}</div>}<p style={{ fontSize: "0.8rem", marginTop: "1rem" }}>Starter supports a small cohort. Growth is for multi-admin programs and Enterprise is for white-label, SSO, and custom reporting.</p></section>}
  </main>;
}
