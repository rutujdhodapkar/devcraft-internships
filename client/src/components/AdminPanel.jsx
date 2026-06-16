import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createReferral,
  deleteReferral,
  deleteEnrollment,
  fetchAdminData,
  fetchAdminReferralUsersWithInterns,
  fetchAdmins,
  addAdmin,
  removeAdmin,
  fetchCareerPaths,
  saveCareerPaths,
  fetchHowItWorks,
  saveHowItWorks,
  fetchFAQs,
  saveFAQs,
  fetchTemplates,
  saveTemplates,
  updateEnrollmentStatus,
  verifyProject,
  allowCertificate,
  saveProjectFeedback,
  rejectProject,
  fetchEnrollmentById,
  verifyTaskWithAI,
} from "../services/data";
import { openCertificatePdf } from "../utils/certificatePdf";

/** Open print dialog for a credential document */
function generateAndPrint(templateHtml, variables) {
  let html = templateHtml;
  Object.entries(variables).forEach(([k, v]) => {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v || "");
  });
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups.");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

const TABS = [
  { id: "interns", label: "Interns" },
  { id: "works", label: "Internship Works" },
  { id: "completed", label: "Completed" },
  { id: "certificates", label: "Certificates" },
  { id: "archived", label: "Archived" },
  { id: "career paths", label: "Domains" },
  { id: "how it works", label: "How It Works" },
  { id: "faq", label: "FAQ" },
  { id: "html templates", label: "Templates" },
  { id: "referrals", label: "Referrals" },
  { id: "add referral", label: "+ Add Referral" },
  { id: "visits", label: "Visits" },
  { id: "referral users", label: "Referral Users" },
  { id: "verify-ai", label: "Verify with AI" },
  { id: "earn-settings", label: "Earn Settings" },
  { id: "manage admins", label: "Admins" },
];

export default function AdminPanel({ onClose, user, onLogout }) {
  const [activeTab, setActiveTab] = useState("interns");
  const [data, setData] = useState({ requests: [], referrals: [], visits: [] });
  const [adminsList, setAdminsList] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [referralUsersData, setReferralUsersData] = useState([]);
  const [referralDataLoading, setReferralDataLoading] = useState(false);

  const [referralForm, setReferralForm] = useState({
    name: "",
    email: "",
    city: "",
    country: "",
    college: "",
    phone: "",
    upiId: "",
  });
  const [newCode, setNewCode] = useState("");

  const [verifyingProject, setVerifyingProject] = useState({}); // { key: bool }
  const [rejectingProject, setRejectingProject] = useState({}); // { key: bool }
  const [showRejectInput, setShowRejectInput] = useState({}); // { key: bool }
  const [rejectFeedback, setRejectFeedback] = useState({}); // { key: string }

  // AI Verification state
  const [aiVerifying, setAiVerifying] = useState({}); // { [subKey]: bool }
  const [aiResults, setAiResults] = useState({}); // { [subKey]: { verified, reason, message, confidence } }
  const [aiError, setAiError] = useState("");
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [pushingAll, setPushingAll] = useState(false);

  // Earn Settings state
  const [earnSettings, setEarnSettings] = useState({
    rewardPerCompletion: 20,
    milestoneCount: 50,
    milestoneBonus: 1000,
  });
  const [earnSettingsLoading, setEarnSettingsLoading] = useState(false);
  const [earnSettingsSaving, setEarnSettingsSaving] = useState(false);

  const [selectedIntern, setSelectedIntern] = useState(null); // for submission detail modal
  // Task feedback & certificate approval states
  const [feedbackInputs, setFeedbackInputs] = useState({}); // { [enrollmentId_projectIdx]: string }
  const [savingFeedback, setSavingFeedback] = useState({}); // { [key]: bool }

  // Populate feedback fields when selectedIntern changes
  useEffect(() => {
    if (selectedIntern) {
      const inputs = {};
      const projects = selectedIntern.projects || [];
      const submissions = selectedIntern.submissions || {};
      projects.forEach((_, idx) => {
        const sub = submissions[idx];
        inputs[`${selectedIntern.id}_${idx}`] = sub?.feedback || "";
      });
      setFeedbackInputs((prev) => ({ ...prev, ...inputs }));
    }
  }, [selectedIntern]);

  // Load referral users / visits when those tabs are active
  useEffect(() => {
    if (activeTab === "referral users") {
      setReferralDataLoading(true);
      fetchAdminReferralUsersWithInterns()
        .then(setReferralUsersData)
        .catch((err) =>
          console.warn("Failed to load referral users:", err.message),
        )
        .finally(() => setReferralDataLoading(false));
    }
    if (activeTab === "visits") {
      loadData();
    }
  }, [activeTab]);

  const handleSaveFeedback = async (enrollmentId, projectIdx) => {
    const key = `${enrollmentId}_${projectIdx}`;
    const fbText = (feedbackInputs[key] || "").trim();
    setSavingFeedback((prev) => ({ ...prev, [key]: true }));
    try {
      await saveProjectFeedback(enrollmentId, projectIdx, fbText);
      setSuccessMsg("Feedback saved successfully!");
      // Reload admin data to sync
      await loadData();
    } catch (err) {
      setError("Failed to save feedback: " + err.message);
    } finally {
      setSavingFeedback((prev) => ({ ...prev, [key]: false }));
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  const handleToggleCertificateAllow = async (enrollmentId, currentVal) => {
    const nextVal = currentVal === "yes" ? "no" : "yes";
    try {
      await allowCertificate(enrollmentId, nextVal);
      setSuccessMsg(`Certificate approval status updated to: ${nextVal}`);
      await loadData();
      if (selectedIntern?.id === enrollmentId) {
        setSelectedIntern((prev) => ({ ...prev, allowedCertificate: nextVal }));
      }
    } catch (err) {
      setError("Failed to update certificate approval: " + err.message);
    } finally {
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  };

  // Dynamic Content States
  const [careerPaths, setCareerPaths] = useState([]);
  const [howItWorksSteps, setHowItWorksSteps] = useState([]);
  const [faqsList, setFaqsList] = useState([]);
  const [templates, setTemplates] = useState({
    offer_letter: "",
    certificate: "",
  });
  const [contentLoading, setContentLoading] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);

  useEffect(() => {
    loadData();
    loadAdmins();
  }, []);

  useEffect(() => {
    if (activeTab === "earn-settings") {
      setEarnSettingsLoading(true);
      import("../services/data").then(({ fetchEarnSettings }) =>
        fetchEarnSettings()
          .then((s) => {
            if (s) setEarnSettings(s);
          })
          .catch(() => {})
          .finally(() => setEarnSettingsLoading(false)),
      );
    }
  }, [activeTab]);

  const loadData = async () => {
    setDataLoading(true);
    setError("");
    try {
      const res = await fetchAdminData();
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setDataLoading(false);
    }
  };

  const loadAdmins = async () => {
    try {
      const list = await fetchAdmins();
      setAdminsList(list || []);
    } catch (err) {
      console.warn("Failed to load admin emails:", err.message);
    }
  };

  const loadDynamicContent = async (tabName) => {
    setContentLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      if (tabName === "career paths") {
        setCareerPaths(JSON.parse(JSON.stringify(await fetchCareerPaths())));
      } else if (tabName === "how it works") {
        setHowItWorksSteps(JSON.parse(JSON.stringify(await fetchHowItWorks())));
      } else if (tabName === "faq") {
        setFaqsList(JSON.parse(JSON.stringify(await fetchFAQs())));
      } else if (tabName === "html templates") {
        setTemplates(await fetchTemplates());
      }
    } catch (err) {
      setError("Failed to fetch content: " + err.message);
    } finally {
      setContentLoading(false);
    }
  };

  const handleStatusToggle = async (enrollmentId, currentStatus) => {
    const nextStatus = currentStatus === "Completed" ? "Active" : "Completed";
    try {
      await updateEnrollmentStatus(enrollmentId, nextStatus);
      await loadData();
      // Update selectedIntern if open
      if (selectedIntern?.id === enrollmentId) {
        setSelectedIntern((prev) => ({ ...prev, status: nextStatus }));
      }
    } catch (err) {
      setError("Failed to toggle status: " + err.message);
    }
  };

  const handleArchiveToggle = async (enrollmentId, currentStatus) => {
    const nextStatus = currentStatus === "Archived" ? "Active" : "Archived";
    try {
      await updateEnrollmentStatus(enrollmentId, nextStatus);
      await loadData();
      if (selectedIntern?.id === enrollmentId) {
        setSelectedIntern((prev) => ({ ...prev, status: nextStatus }));
      }
    } catch (err) {
      setError("Failed to update archive status: " + err.message);
    }
  };

  const handleVerifyProject = async (enrollmentId, projectIdx) => {
    const key = `${enrollmentId}_${projectIdx}`;
    setVerifyingProject((prev) => ({ ...prev, [key]: true }));
    try {
      await verifyProject(enrollmentId, projectIdx);
      const fresh = await fetchEnrollmentById(enrollmentId);
      if (fresh && selectedIntern?.id === enrollmentId) {
        setSelectedIntern(fresh);
      }
      await loadData();
      setSuccessMsg("Task verified.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Failed to verify project: " + err.message);
    } finally {
      setVerifyingProject((prev) => ({ ...prev, [key]: false }));
    }
  };

  const noticeTimers = useRef({});
  const [noticeSaving, setNoticeSaving] = useState({});

  const autoSaveNotice = (pathIdx, pIdx, notice) => {
    const key = `${pathIdx}_${pIdx}`;
    if (noticeTimers.current[key]) clearTimeout(noticeTimers.current[key]);
    noticeTimers.current[key] = setTimeout(async () => {
      setNoticeSaving((prev) => ({ ...prev, [key]: true }));
      try {
        await saveCareerPaths(careerPaths);
        setNoticeSaving((prev) => ({ ...prev, [key]: false }));
      } catch (err) {
        setNoticeSaving((prev) => ({ ...prev, [key]: false }));
        setError("Failed to save notice: " + err.message);
      }
    }, 800);
  };

  const handleRejectProject = async (enrollmentId, projectIdx) => {
    const key = `${enrollmentId}_${projectIdx}`;
    const feedback = (rejectFeedback[key] || "").trim();
    setRejectingProject((prev) => ({ ...prev, [key]: true }));
    try {
      await rejectProject(enrollmentId, projectIdx, feedback);
      const fresh = await fetchEnrollmentById(enrollmentId);
      if (fresh && selectedIntern?.id === enrollmentId) {
        setSelectedIntern(fresh);
      }
      await loadData();
      setShowRejectInput((prev) => ({ ...prev, [key]: false }));
      setRejectFeedback((prev) => ({ ...prev, [key]: "" }));
      setSuccessMsg("Resubmission requested.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Failed to request resubmission: " + err.message);
    } finally {
      setRejectingProject((prev) => ({ ...prev, [key]: false }));
    }
  };

  const metrics = useMemo(() => {
    const visible = data.requests.filter((i) => i.status !== "Archived");
    const active = visible.filter((i) => i.status === "Active").length;
    const completed = visible.filter((i) => i.status === "Completed").length;
    const archived = data.requests.filter(
      (i) => i.status === "Archived",
    ).length;
    return {
      total: visible.length,
      active,
      completed,
      archived,
      referrals: data.referrals.length,
    };
  }, [data]);

  // Helpers
  const getProjectsForEnrollment = (enrollment) => enrollment.projects || [];
  const getSubmissions = (enrollment) => enrollment.submissions || {};
  const getCompletionPct = (enrollment) => {
    const projects = getProjectsForEnrollment(enrollment);
    if (projects.length === 0) return 0;
    const subs = getSubmissions(enrollment);
    const verified = projects.filter((_, i) => subs[i]?.verified).length;
    return Math.round((verified / projects.length) * 100);
  };
  const getSubmittedCount = (enrollment) => {
    const projects = getProjectsForEnrollment(enrollment);
    const subs = getSubmissions(enrollment);
    return projects.filter((_, i) => subs[i]?.submittedAt).length;
  };
  const getVerifiedCount = (enrollment) => {
    const projects = getProjectsForEnrollment(enrollment);
    const subs = getSubmissions(enrollment);
    return projects.filter((_, i) => subs[i]?.verified).length;
  };
  const activeRequests = data.requests.filter(
    (row) => row.status !== "Archived" && row.status !== "Completed",
  );
  const completedRequests = data.requests.filter(
    (row) => row.status === "Completed",
  );
  const visibleRequests = data.requests.filter(
    (row) => row.status !== "Archived",
  );
  const archivedRequests = data.requests.filter(
    (row) => row.status === "Archived",
  );

  const handleReferralSubmit = async (event) => {
    event.preventDefault();
    setReferralLoading(true);
    setError("");
    try {
      const referral = await createReferral(referralForm);
      setNewCode(referral.code);
      setReferralForm({ name: "", email: "", city: "", phone: "", upiId: "" });
      await loadData();
      setActiveTab("referrals");
    } catch (err) {
      setError(err.message);
    } finally {
      setReferralLoading(false);
    }
  };

  const handleSaveCareerPaths = async () => {
    setContentSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      await saveCareerPaths(careerPaths);
      setSuccessMsg("Career paths saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setContentSaving(false);
    }
  };
  const handleSaveHowItWorks = async () => {
    setContentSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      await saveHowItWorks(howItWorksSteps);
      setSuccessMsg("How it works saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setContentSaving(false);
    }
  };
  const handleSaveFAQs = async () => {
    setContentSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      await saveFAQs(faqsList);
      setSuccessMsg("FAQs saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setContentSaving(false);
    }
  };
  const handleSaveTemplates = async () => {
    setContentSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      await saveTemplates(templates);
      setSuccessMsg("Templates saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setContentSaving(false);
    }
  };

  const handleAddAdminSubmit = async (e) => {
    e.preventDefault();
    if (!newAdminEmail) return;
    setAdminActionLoading(true);
    setError("");
    try {
      await addAdmin(newAdminEmail);
      setNewAdminEmail("");
      await loadAdmins();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleRemoveAdmin = async (email) => {
    if (window.confirm(`Remove admin access for ${email}?`)) {
      setAdminActionLoading(true);
      setError("");
      try {
        await removeAdmin(email);
        await loadAdmins();
      } catch (err) {
        setError(err.message);
      } finally {
        setAdminActionLoading(false);
      }
    }
  };

  const handleDeleteReferral = async (code) => {
    if (
      window.confirm(
        `Delete referral "${code}"? This will remove all associated data.`,
      )
    ) {
      setError("");
      setSuccessMsg("");
      try {
        await deleteReferral(code);
        await loadData();
        setSuccessMsg(`Referral ${code} deleted.`);
        setTimeout(() => setSuccessMsg(""), 3000);
      } catch (err) {
        setError("Failed to delete referral: " + err.message);
      }
    }
  };

  const handleDeleteEnrollment = async (enrollmentId, name) => {
    if (
      window.confirm(`Delete enrollment for "${name}"? This cannot be undone.`)
    ) {
      setError("");
      setSuccessMsg("");
      try {
        await deleteEnrollment(enrollmentId);
        await loadData();
        setSelectedIntern(null);
        setSuccessMsg(`Enrollment for ${name} deleted.`);
        setTimeout(() => setSuccessMsg(""), 3000);
      } catch (err) {
        setError("Failed to delete enrollment: " + err.message);
      }
    }
  };

  const handleGenerateCertificate = async (enrollment) => {
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    openCertificatePdf({
      name: enrollment.name,
      domain: enrollment.domain,
      date,
      id: enrollment.id,
      internId: enrollment.internId || enrollment.id,
    });
    // Mark as Completed
    if (enrollment.status !== "Completed") {
      await updateEnrollmentStatus(enrollment.id, "Completed");
      await loadData();
    }
  };

  const s = {
    border: "2px solid #000",
    padding: "0.4rem 0.6rem",
    boxSizing: "border-box",
    fontSize: "0.85rem",
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
  };

  return (
    <section
      style={{
        backgroundColor: "#fff",
        minHeight: "100vh",
        padding: "2rem 1rem 5rem",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "2rem",
            paddingBottom: "1.5rem",
            borderBottom: "3px solid #000",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "0.25rem",
              }}
            >
              <button
                onClick={onClose}
                title="Back to website"
                style={{
                  background: "none",
                  border: "2px solid #000",
                  padding: "0.3rem 0.75rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                ← Home
              </button>
              <span
                style={{
                  background: "#000",
                  color: "#fff",
                  fontSize: "0.68rem",
                  fontWeight: 900,
                  letterSpacing: "2px",
                  padding: "0.2rem 0.6rem",
                  textTransform: "uppercase",
                }}
              >
                Admin Panel
              </span>
            </div>
            <h2
              style={{
                fontSize: "1.8rem",
                fontWeight: 900,
                textTransform: "uppercase",
                margin: "0.25rem 0 0",
              }}
            >
              DevCraft Admin Dashboard
            </h2>
            {user && (
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "#888",
                  marginTop: "0.2rem",
                }}
              >
                Logged in as <strong>{user.displayName || "Admin"}</strong> (
                {user.email})
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              className="btn-sharp-outline"
              onClick={() => {
                loadData();
                loadAdmins();
              }}
              type="button"
              style={{ fontSize: "0.82rem" }}
            >
              {dataLoading ? "⟳ Refreshing…" : "⟳ Refresh Data"}
            </button>
            {onLogout && (
              <button
                className="btn-sharp-outline"
                onClick={onLogout}
                type="button"
                style={{ fontSize: "0.82rem" }}
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            style={{
              border: "2px solid #EA4335",
              padding: "0.9rem 1rem",
              color: "#EA4335",
              fontWeight: "bold",
              backgroundColor: "#FFF5F5",
              marginBottom: "1.5rem",
              fontSize: "0.88rem",
            }}
          >
            {error}
          </div>
        )}
        {successMsg && (
          <div
            style={{
              border: "2px solid #34A853",
              padding: "0.9rem 1rem",
              color: "#34A853",
              fontWeight: "bold",
              backgroundColor: "#EBFCEF",
              marginBottom: "1.5rem",
              fontSize: "0.88rem",
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Metrics */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <MetricCard label="Total Interns" value={metrics.total} />
          <MetricCard label="Active" value={metrics.active} color="#FBBC05" />
          <MetricCard
            label="Completed"
            value={metrics.completed}
            color="#34A853"
          />
          <MetricCard label="Archived" value={metrics.archived} color="#555" />
          <MetricCard label="Referrals" value={metrics.referrals} />
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
            marginBottom: "2rem",
            borderBottom: "2px solid #000",
            paddingBottom: "0.75rem",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (
                  [
                    "career paths",
                    "how it works",
                    "faq",
                    "html templates",
                  ].includes(tab.id)
                ) {
                  loadDynamicContent(tab.id);
                }
              }}
              style={{
                padding: "0.4rem 0.9rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                border: "2px solid #000",
                background: activeTab === tab.id ? "#000" : "#fff",
                color: activeTab === tab.id ? "#fff" : "#000",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── 1. INTERNS TAB ── */}
        {activeTab === "interns" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Active Applied Interns ({activeRequests.length})
              </h3>
            </div>
            {activeRequests.length === 0 ? (
              <EmptyBox msg="No intern registrations yet." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.83rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#fff",
                        color: "#000",
                        borderBottom: "2px solid #000",
                      }}
                    >
                      <th style={th}>Intern ID</th>
                      <th style={th}>Referral</th>
                      <th style={th}>Name</th>
                      <th style={th}>Email</th>
                      <th style={th}>Domain</th>
                      <th style={th}>Country</th>
                      <th style={th}>College</th>
                      <th style={th}>Status</th>
                      <th style={th}>Completed %</th>
                      <th style={th}>Submissions</th>
                      <th style={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRequests.map((row, i) => {
                      const pct = getCompletionPct(row);
                      const subCount = getSubmittedCount(row);
                      const totalProj = getProjectsForEnrollment(row).length;
                      return (
                        <tr
                          key={row.id}
                          style={{
                            borderBottom: "1px solid #e0e0e0",
                            background: i % 2 === 0 ? "#fafafa" : "#fff",
                          }}
                        >
                          <td style={td}>
                            <code
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                color: "#000",
                              }}
                            >
                              {row.internId || row.id.slice(0, 8)}
                            </code>
                          </td>
                          <td style={td}>
                            {row.referralCode ? (
                              <code
                                style={{ fontSize: "0.72rem", fontWeight: 700 }}
                              >
                                {row.referralCode}
                              </code>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td style={td}>
                            <strong>{row.name}</strong>
                          </td>
                          <td style={td}>{row.email}</td>
                          <td style={td}>{row.domain}</td>
                          <td style={td}>{row.country || row.city || "-"}</td>
                          <td style={td}>{row.college || "-"}</td>
                          <td style={td}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.15rem 0.5rem",
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                background:
                                  row.status === "Completed"
                                    ? "#34A853"
                                    : "#FBBC05",
                                color: "#fff",
                                textTransform: "uppercase",
                              }}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td style={td}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                              }}
                            >
                              <div
                                style={{
                                  height: "6px",
                                  width: "60px",
                                  background: "#e0e0e0",
                                  borderRadius: 0,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${pct}%`,
                                    background:
                                      pct === 100 ? "#34A853" : "#FBBC05",
                                  }}
                                />
                              </div>
                              <span
                                style={{ fontSize: "0.75rem", fontWeight: 700 }}
                              >
                                {pct}%
                              </span>
                            </div>
                          </td>
                          <td style={td}>
                            <button
                              type="button"
                              onClick={() => setSelectedIntern(row)}
                              style={{
                                padding: "0.2rem 0.6rem",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                border: "2px solid #000",
                                background: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              View ({subCount}/{totalProj})
                            </button>
                          </td>
                          <td style={td}>
                            {pct === 100 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusToggle(row.id, row.status)
                                }
                                style={{
                                  padding: "0.2rem 0.6rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  border: "2px solid #34A853",
                                  background: "#34A853",
                                  color: "#fff",
                                  cursor: "pointer",
                                  marginRight: "0.35rem",
                                }}
                              >
                                Completed
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleArchiveToggle(row.id, row.status)
                              }
                              style={{
                                padding: "0.2rem 0.6rem",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                border: "2px solid #555",
                                background: "#fff",
                                color: "#555",
                                cursor: "pointer",
                                marginRight: "0.35rem",
                              }}
                            >
                              Archive
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteEnrollment(row.id, row.name)
                              }
                              style={{
                                padding: "0.2rem 0.6rem",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                border: "2px solid #EA4335",
                                background: "#fff",
                                color: "#EA4335",
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── 2. INTERNSHIP WORKS TAB ── */}
        {activeTab === "works" && (
          <div>
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: "1.5rem",
              }}
            >
              Internship Works — Progress Overview
            </h3>
            {(() => {
              const pendingTasks = activeRequests.flatMap((enrollment) => {
                const projects = getProjectsForEnrollment(enrollment);
                const submissions = getSubmissions(enrollment);
                return projects
                  .map((project, idx) => ({
                    enrollment,
                    project,
                    idx,
                    submission: submissions[idx],
                  }))
                  .filter(
                    (item) =>
                      item.submission?.submittedAt &&
                      !item.submission?.verified,
                  );
              });

              return (
                <div style={{ marginBottom: "2rem" }}>
                  <h4
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 900,
                      textTransform: "uppercase",
                      marginBottom: "1rem",
                      color: "#000",
                    }}
                  >
                    Submitted Tasks Awaiting Verification ({pendingTasks.length}
                    )
                  </h4>
                  {pendingTasks.length === 0 ? (
                    <EmptyBox msg="No submitted tasks are waiting for verification." />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.9rem",
                      }}
                    >
                      {pendingTasks.map(
                        ({ enrollment, project, idx, submission }) => {
                          const key = `${enrollment.id}_${idx}`;
                          const title =
                            typeof project === "object" && project !== null
                              ? project.title ||
                                project.name ||
                                `Task ${idx + 1}`
                              : project;
                          return (
                            <div
                              key={key}
                              style={{
                                border: "2px solid #FBBC05",
                                background: "#fffdf0",
                                padding: "1rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.75rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: "1rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div>
                                  <div
                                    style={{ fontWeight: 900, color: "#000" }}
                                  >
                                    {enrollment.name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "0.8rem",
                                      color: "#555",
                                    }}
                                  >
                                    {enrollment.internId || enrollment.id} |{" "}
                                    {enrollment.domain}
                                  </div>
                                  <div
                                    style={{
                                      marginTop: "0.35rem",
                                      fontWeight: 800,
                                      color: "#000",
                                    }}
                                  >
                                    Task {idx + 1}: {title}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "0.5rem",
                                    alignItems: "flex-start",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleVerifyProject(enrollment.id, idx)
                                    }
                                    disabled={verifyingProject[key]}
                                    style={{
                                      padding: "0.35rem 0.85rem",
                                      fontSize: "0.78rem",
                                      fontWeight: 800,
                                      border: "2px solid #34A853",
                                      background: "#34A853",
                                      color: "#fff",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {verifyingProject[key]
                                      ? "Verifying..."
                                      : "Verify"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowRejectInput((prev) => ({
                                        ...prev,
                                        [key]: !prev[key],
                                      }))
                                    }
                                    style={{
                                      padding: "0.35rem 0.85rem",
                                      fontSize: "0.78rem",
                                      fontWeight: 800,
                                      border: "2px solid #EA4335",
                                      background: "#fff",
                                      color: "#EA4335",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Don't Verify
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedIntern(enrollment)
                                    }
                                    style={{
                                      padding: "0.35rem 0.85rem",
                                      fontSize: "0.78rem",
                                      fontWeight: 800,
                                      border: "2px solid #000",
                                      background: "#000",
                                      color: "#fff",
                                      cursor: "pointer",
                                    }}
                                  >
                                    View Intern
                                  </button>
                                </div>
                              </div>
                              <div
                                style={{
                                  padding: "0.65rem 0.85rem",
                                  background: "#fff",
                                  border: "1px solid #ddd",
                                  fontSize: "0.86rem",
                                  color: "#222",
                                  wordBreak: "break-all",
                                }}
                              >
                                {submission.text}
                              </div>
                              <div
                                style={{ fontSize: "0.72rem", color: "#777" }}
                              >
                                Submitted:{" "}
                                {new Date(
                                  submission.submittedAt,
                                ).toLocaleString()}
                              </div>
                              {showRejectInput[key] && (
                                <div
                                  style={{
                                    borderTop: "1px solid #e5e5e5",
                                    paddingTop: "0.75rem",
                                  }}
                                >
                                  <label
                                    style={{
                                      fontSize: "0.72rem",
                                      fontWeight: 800,
                                      textTransform: "uppercase",
                                      display: "block",
                                      marginBottom: "0.35rem",
                                      color: "#EA4335",
                                    }}
                                  >
                                    Message to intern (optional)
                                  </label>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "0.5rem",
                                      alignItems: "flex-end",
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <textarea
                                      rows={2}
                                      placeholder="Tell the intern what to fix..."
                                      value={rejectFeedback[key] || ""}
                                      onChange={(e) =>
                                        setRejectFeedback((prev) => ({
                                          ...prev,
                                          [key]: e.target.value,
                                        }))
                                      }
                                      style={{
                                        flex: 1,
                                        minWidth: "260px",
                                        padding: "0.5rem 0.75rem",
                                        border: "2px solid #EA4335",
                                        fontSize: "0.85rem",
                                        outline: "none",
                                        fontFamily: "inherit",
                                        resize: "vertical",
                                        boxSizing: "border-box",
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRejectProject(enrollment.id, idx)
                                      }
                                      disabled={rejectingProject[key]}
                                      style={{
                                        padding: "0.55rem 1rem",
                                        fontSize: "0.8rem",
                                        fontWeight: 800,
                                        border: "2px solid #EA4335",
                                        background: "#EA4335",
                                        color: "#fff",
                                        cursor: "pointer",
                                      }}
                                    >
                                      {rejectingProject[key]
                                        ? "Sending..."
                                        : "Request Resubmission"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {activeRequests.length === 0 ? (
              <EmptyBox msg="No intern submissions yet." />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {activeRequests.map((enrollment) => {
                  const projects = getProjectsForEnrollment(enrollment);
                  if (projects.length === 0) return null;
                  const subs = getSubmissions(enrollment);
                  const completedCount = projects.filter(
                    (_, i) => subs[i]?.verified,
                  ).length;
                  const remainingCount = projects.length - completedCount;
                  const allTasksDone =
                    projects.length > 0 && remainingCount === 0;
                  const isCompleted = enrollment.status === "Completed";
                  return (
                    <div
                      key={enrollment.id}
                      style={{
                        border: "2px solid #000",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "1rem 1.25rem",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                        background: "#fff",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: "1rem",
                            color: "#000",
                          }}
                        >
                          {enrollment.name}
                        </div>
                        {!isCompleted && (
                          <div
                            style={{
                              marginTop: "0.3rem",
                              display: "inline-block",
                              background: "#EA4335",
                              color: "#fff",
                              fontSize: "0.62rem",
                              fontWeight: 900,
                              padding: "0.15rem 0.55rem",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            NOT DONE
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "1.5rem",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ textAlign: "center" }}>
                          <div
                            style={{
                              fontSize: "1.4rem",
                              fontWeight: 900,
                              color: "#34A853",
                            }}
                          >
                            {completedCount}
                          </div>
                          <div
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color: "#888",
                              textTransform: "uppercase",
                            }}
                          >
                            Completed
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div
                            style={{
                              fontSize: "1.4rem",
                              fontWeight: 900,
                              color: remainingCount > 0 ? "#FBBC05" : "#ccc",
                            }}
                          >
                            {remainingCount}
                          </div>
                          <div
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color: "#888",
                              textTransform: "uppercase",
                            }}
                          >
                            Not Completed
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              padding: "0.2rem 0.6rem",
                              fontSize: "0.72rem",
                              fontWeight: 800,
                              background: isCompleted ? "#34A853" : "#FBBC05",
                              color: "#fff",
                              textTransform: "uppercase",
                            }}
                          >
                            {enrollment.status}
                          </span>
                          {allTasksDone && (
                            <button
                              onClick={() =>
                                handleStatusToggle(
                                  enrollment.id,
                                  enrollment.status,
                                )
                              }
                              style={{
                                padding: "0.3rem 0.8rem",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                border: "2px solid #34A853",
                                background: "#34A853",
                                color: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              Completed
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handleStatusToggle(
                                enrollment.id,
                                enrollment.status,
                              )
                            }
                            disabled={!allTasksDone}
                            style={{
                              padding: "0.3rem 0.8rem",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              border: "2px solid #000",
                              background: "#fff",
                              color: "#000",
                              cursor: allTasksDone ? "pointer" : "not-allowed",
                              opacity: allTasksDone ? 1 : 0.45,
                            }}
                          >
                            {isCompleted ? "Mark Active" : "Mark Completed"}
                          </button>
                          <button
                            onClick={() =>
                              handleArchiveToggle(
                                enrollment.id,
                                enrollment.status,
                              )
                            }
                            style={{
                              padding: "0.3rem 0.8rem",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              border: "2px solid #555",
                              background: "#fff",
                              color: "#555",
                              cursor: "pointer",
                            }}
                          >
                            Archive
                          </button>
                          <button
                            onClick={() => setSelectedIntern(enrollment)}
                            style={{
                              padding: "0.3rem 0.8rem",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              border: "2px solid #000",
                              background: "#000",
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 3. CERTIFICATES TAB ── */}
        {activeTab === "completed" && (
          <div>
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: "1.5rem",
              }}
            >
              Completed Internships ({completedRequests.length})
            </h3>
            {completedRequests.length === 0 ? (
              <EmptyBox msg="No completed internships yet." />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {completedRequests.map((enrollment) => {
                  const completedCount = getVerifiedCount(enrollment);
                  const total = getProjectsForEnrollment(enrollment).length;
                  return (
                    <div
                      key={enrollment.id}
                      style={{
                        border: "2px solid #34A853",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "1rem 1.25rem",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                        background: "#f0fdf4",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: "1rem",
                            color: "#000",
                          }}
                        >
                          {enrollment.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#555",
                            marginTop: "0.1rem",
                          }}
                        >
                          {enrollment.internId || enrollment.id} |{" "}
                          {enrollment.domain} | {completedCount}/{total} tasks
                          verified
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => setSelectedIntern(enrollment)}
                          style={{
                            padding: "0.3rem 0.8rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            border: "2px solid #000",
                            background: "#000",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          View Details
                        </button>
                        <button
                          onClick={() =>
                            handleStatusToggle(enrollment.id, enrollment.status)
                          }
                          style={{
                            padding: "0.3rem 0.8rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            border: "2px solid #000",
                            background: "#fff",
                            color: "#000",
                            cursor: "pointer",
                          }}
                        >
                          Move to Active
                        </button>
                        <button
                          onClick={() =>
                            handleArchiveToggle(
                              enrollment.id,
                              enrollment.status,
                            )
                          }
                          style={{
                            padding: "0.3rem 0.8rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            border: "2px solid #555",
                            background: "#fff",
                            color: "#555",
                            cursor: "pointer",
                          }}
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "certificates" && (
          <div>
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: "0.5rem",
              }}
            >
              Certificate Approvals & Generation
            </h3>
            <p
              style={{
                color: "#666",
                fontSize: "0.85rem",
                marginBottom: "1.5rem",
              }}
            >
              The interns listed below have completed all projects and submitted
              their payment Transaction ID. Review payment details and toggle
              approval to unlock the download certificate button on their
              dashboard.
            </p>
            {(() => {
              const eligible = completedRequests;
              return eligible.length === 0 ? (
                <EmptyBox msg="No interns marked as Completed yet. Use the Works tab to mark an intern as Completed." />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem",
                  }}
                >
                  {eligible.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      style={{
                        border: "2px solid #000",
                        padding: "1.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "1.5rem",
                        background: "#fff",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "280px" }}>
                        <div
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "#888",
                            marginBottom: "0.2rem",
                          }}
                        >
                          {enrollment.internId || enrollment.id}
                        </div>
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: "1.2rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {enrollment.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "#333",
                            marginBottom: "0.75rem",
                          }}
                        >
                          <strong>College:</strong> {enrollment.college || "-"}{" "}
                          <br />
                          <strong>Email:</strong> {enrollment.email} |{" "}
                          <strong>Phone:</strong> {enrollment.phone || "-"}{" "}
                          <br />
                          <strong>Domain:</strong> {enrollment.domain}
                        </div>
                        <div
                          style={{
                            padding: "0.6rem 0.85rem",
                            background: enrollment.transactionId
                              ? "#f0fdf4"
                              : "#fff5f5",
                            border: enrollment.transactionId
                              ? "2px solid #34A853"
                              : "2px solid #EA4335",
                            fontSize: "0.82rem",
                            display: "inline-block",
                          }}
                        >
                          {enrollment.transactionId ? (
                            <>
                              <strong style={{ color: "#34A853" }}>
                                Transaction ID Submitted:
                              </strong>{" "}
                              <code
                                style={{
                                  fontSize: "0.9rem",
                                  color: "#000",
                                  fontWeight: "bold",
                                }}
                              >
                                {enrollment.transactionId}
                              </code>
                            </>
                          ) : (
                            <strong style={{ color: "#EA4335" }}>
                              Transaction ID Not Submitted
                            </strong>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                          alignItems: "flex-end",
                          minWidth: "200px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          <span
                            style={{ fontSize: "0.78rem", fontWeight: 700 }}
                          >
                            Download Status:
                          </span>
                          <span
                            style={{
                              padding: "0.15rem 0.5rem",
                              fontSize: "0.72rem",
                              fontWeight: 800,
                              background:
                                enrollment.allowedCertificate === "yes"
                                  ? "#34A853"
                                  : "#EA4335",
                              color: "#fff",
                              textTransform: "uppercase",
                            }}
                          >
                            {enrollment.allowedCertificate === "yes"
                              ? "Allowed"
                              : "Locked"}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            onClick={() =>
                              handleToggleCertificateAllow(
                                enrollment.id,
                                enrollment.allowedCertificate,
                              )
                            }
                            className="btn-sharp-outline"
                            style={{
                              padding: "0.4rem 1rem",
                              fontSize: "0.8rem",
                              borderRadius: 0,
                            }}
                          >
                            {enrollment.allowedCertificate === "yes"
                              ? "Lock Certificate"
                              : "Allow Certificate"}
                          </button>

                          <button
                            onClick={() =>
                              handleGenerateCertificate(enrollment)
                            }
                            className="btn-sharp"
                            style={{
                              padding: "0.4rem 1rem",
                              fontSize: "0.8rem",
                              borderRadius: 0,
                            }}
                          >
                            Print Certificate
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── 4. CAREER PATHS MANAGER ── */}
        {/* Archived internships */}
        {activeTab === "archived" && (
          <div>
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: "1.5rem",
              }}
            >
              Archived Internships
            </h3>
            {archivedRequests.length === 0 ? (
              <EmptyBox msg="No archived internships." />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {archivedRequests.map((enrollment) => {
                  const completedCount = getVerifiedCount(enrollment);
                  const total = getProjectsForEnrollment(enrollment).length;
                  return (
                    <div
                      key={enrollment.id}
                      style={{
                        border: "2px solid #555",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "1rem 1.25rem",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                        background: "#fafafa",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: "1rem",
                            color: "#000",
                          }}
                        >
                          {enrollment.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#555",
                            marginTop: "0.1rem",
                          }}
                        >
                          {enrollment.domain} | {completedCount}/{total} tasks
                          verified
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => setSelectedIntern(enrollment)}
                          style={{
                            padding: "0.3rem 0.8rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            border: "2px solid #000",
                            background: "#000",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          View Details
                        </button>
                        <button
                          onClick={() =>
                            handleArchiveToggle(
                              enrollment.id,
                              enrollment.status,
                            )
                          }
                          style={{
                            padding: "0.3rem 0.8rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            border: "2px solid #34A853",
                            background: "#fff",
                            color: "#188038",
                            cursor: "pointer",
                          }}
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "career paths" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Manage Internship Domains
              </h3>
              <button
                type="button"
                className="btn-sharp-outline"
                onClick={() =>
                  setCareerPaths([
                    ...careerPaths,
                    {
                      id: "path_" + Date.now(),
                      title: "New Domain",
                      duration: "4 Weeks",
                      description: "Brief description.",
                      features: ["Feature 1"],
                      projects: [
                        { title: "Project 1", description: "", links: "" },
                      ],
                    },
                  ])
                }
              >
                + Add Domain
              </button>
            </div>
            {contentLoading ? (
              <div style={{ color: "#888" }}>Loading…</div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                {careerPaths.map((path, idx) => (
                  <div
                    key={path.id}
                    style={{
                      border: "2px solid #000",
                      padding: "1.5rem",
                      boxShadow: "3px 3px 0 #000",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "1rem",
                      }}
                    >
                      <strong style={{ textTransform: "uppercase" }}>
                        Domain #{idx + 1}
                      </strong>
                      <button
                        type="button"
                        onClick={() =>
                          setCareerPaths(
                            careerPaths.filter((p) => p.id !== path.id),
                          )
                        }
                        style={{
                          border: "1px solid #EA4335",
                          color: "#EA4335",
                          background: "none",
                          cursor: "pointer",
                          padding: "0.1rem 0.4rem",
                          fontSize: "0.8rem",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.75rem",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            display: "block",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Title
                        </label>
                        <input
                          className="input-sharp"
                          value={path.title}
                          onChange={(e) => {
                            const u = [...careerPaths];
                            u[idx].title = e.target.value;
                            setCareerPaths(u);
                          }}
                          style={s}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            display: "block",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Duration
                        </label>
                        <input
                          className="input-sharp"
                          value={path.duration}
                          onChange={(e) => {
                            const u = [...careerPaths];
                            u[idx].duration = e.target.value;
                            setCareerPaths(u);
                          }}
                          style={s}
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: "0.75rem" }}>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Description
                      </label>
                      <textarea
                        className="input-sharp"
                        rows={2}
                        value={path.description}
                        onChange={(e) => {
                          const u = [...careerPaths];
                          u[idx].description = e.target.value;
                          setCareerPaths(u);
                        }}
                        style={{ ...s, resize: "vertical" }}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.75rem",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            display: "block",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Features (comma-separated)
                        </label>
                        <textarea
                          className="input-sharp"
                          rows={2}
                          value={path.features ? path.features.join(", ") : ""}
                          onChange={(e) => {
                            const u = [...careerPaths];
                            u[idx].features = e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean);
                            setCareerPaths(u);
                          }}
                          style={{ ...s, resize: "vertical" }}
                        />
                      </div>
                      <div style={{ marginTop: "1rem" }}>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            display: "block",
                            marginBottom: "0.75rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Project Tasks
                        </label>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "1rem",
                            marginBottom: "0.75rem",
                          }}
                        >
                          {(path.projects || []).map((proj, pIdx) => {
                            const title =
                              typeof proj === "object"
                                ? proj.title || ""
                                : proj;
                            const desc =
                              typeof proj === "object"
                                ? proj.description || ""
                                : "";
                            const links =
                              typeof proj === "object" ? proj.links || "" : "";
                            const updateProj = (field, val) => {
                              const u = JSON.parse(JSON.stringify(careerPaths));
                              const current = u[idx].projects[pIdx];
                              const obj =
                                typeof current === "object"
                                  ? { ...current }
                                  : {
                                      title: current,
                                      description: "",
                                      links: "",
                                    };
                              obj[field] = val;
                              u[idx].projects[pIdx] = obj;
                              setCareerPaths(u);
                            };
                            return (
                              <div
                                key={pIdx}
                                style={{
                                  border: "2px solid #000",
                                  padding: "1rem",
                                  background: "#fafafa",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: "0.75rem",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "0.72rem",
                                      fontWeight: 900,
                                      textTransform: "uppercase",
                                      color: "#555",
                                    }}
                                  >
                                    Task #{pIdx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const u = JSON.parse(
                                        JSON.stringify(careerPaths),
                                      );
                                      u[idx].projects = u[idx].projects.filter(
                                        (_, i) => i !== pIdx,
                                      );
                                      setCareerPaths(u);
                                    }}
                                    style={{
                                      border: "2px solid #EA4335",
                                      color: "#EA4335",
                                      background: "#fff",
                                      cursor: "pointer",
                                      padding: "0.2rem 0.6rem",
                                      fontSize: "0.72rem",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div style={{ marginBottom: "0.5rem" }}>
                                  <label
                                    style={{
                                      fontSize: "0.7rem",
                                      fontWeight: 700,
                                      display: "block",
                                      marginBottom: "0.2rem",
                                    }}
                                  >
                                    Task Title *
                                  </label>
                                  <input
                                    className="input-sharp"
                                    value={title}
                                    onChange={(e) =>
                                      updateProj("title", e.target.value)
                                    }
                                    placeholder="e.g. Personal Portfolio Website"
                                    style={s}
                                  />
                                </div>
                                <div style={{ marginBottom: "0.5rem" }}>
                                  <label
                                    style={{
                                      fontSize: "0.7rem",
                                      fontWeight: 700,
                                      display: "block",
                                      marginBottom: "0.2rem",
                                    }}
                                  >
                                    Description
                                  </label>
                                  <textarea
                                    className="input-sharp"
                                    rows={2}
                                    value={desc}
                                    onChange={(e) =>
                                      updateProj("description", e.target.value)
                                    }
                                    placeholder="Describe what the intern must build or submit for this task…"
                                    style={{ ...s, resize: "vertical" }}
                                  />
                                </div>
                                <div>
                                  <label
                                    style={{
                                      fontSize: "0.7rem",
                                      fontWeight: 700,
                                      display: "block",
                                      marginBottom: "0.2rem",
                                    }}
                                  >
                                    Reference Links (comma-separated)
                                  </label>
                                  <input
                                    className="input-sharp"
                                    value={links}
                                    onChange={(e) =>
                                      updateProj("links", e.target.value)
                                    }
                                    placeholder="https://example.com, https://docs.example.com"
                                    style={s}
                                  />
                                </div>
                                <div style={{ marginTop: "0.5rem" }}>
                                  <label
                                    style={{
                                      fontSize: "0.7rem",
                                      fontWeight: 700,
                                      display: "block",
                                      marginBottom: "0.2rem",
                                    }}
                                  >
                                    Notice to Intern{" "}
                                    {noticeSaving[`${idx}_${pIdx}`]
                                      ? "(saving…)"
                                      : ""}
                                  </label>
                                  <textarea
                                    className="input-sharp"
                                    rows={2}
                                    value={proj.notice || ""}
                                    onChange={(e) => {
                                      updateProj("notice", e.target.value);
                                      autoSaveNotice(idx, pIdx, e.target.value);
                                    }}
                                    placeholder="Optional notice or instructions displayed to the intern for this task…"
                                    style={{
                                      ...s,
                                      resize: "vertical",
                                      borderColor: proj.notice
                                        ? "#FBBC05"
                                        : "#000",
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const u = JSON.parse(JSON.stringify(careerPaths));
                            u[idx].projects = [
                              ...(u[idx].projects || []),
                              { title: "New Task", description: "", links: "" },
                            ];
                            setCareerPaths(u);
                          }}
                          style={{
                            border: "2px solid #000",
                            color: "#000",
                            background: "#fff",
                            cursor: "pointer",
                            padding: "0.35rem 0.9rem",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                          }}
                        >
                          + Add Task
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSaveCareerPaths}
                  className="btn-sharp"
                  disabled={contentSaving}
                  style={{ alignSelf: "flex-start", padding: "0.7rem 2rem" }}
                >
                  {contentSaving ? "Saving…" : "Save Domains"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 5. HOW IT WORKS ── */}
        {activeTab === "how it works" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              How It Works Timeline
            </h3>
            {contentLoading ? (
              <div style={{ color: "#888" }}>Loading…</div>
            ) : (
              <>
                {howItWorksSteps.map((step, idx) => (
                  <div
                    key={step.id || idx}
                    style={{
                      border: "2px solid #000",
                      padding: "1.25rem",
                      boxShadow: "3px 3px 0 #000",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <span
                        style={{
                          width: "24px",
                          height: "24px",
                          background: "#000",
                          color: "#fff",
                          borderRadius: "50%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.75rem",
                          fontWeight: 900,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <strong>Step {idx + 1}</strong>
                    </div>
                    <div style={{ marginBottom: "0.75rem" }}>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Title
                      </label>
                      <input
                        className="input-sharp"
                        value={step.title || ""}
                        onChange={(e) => {
                          const u = [...howItWorksSteps];
                          u[idx].title = e.target.value;
                          setHowItWorksSteps(u);
                        }}
                        style={s}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Description
                      </label>
                      <textarea
                        className="input-sharp"
                        rows={2}
                        value={step.description || ""}
                        onChange={(e) => {
                          const u = [...howItWorksSteps];
                          u[idx].description = e.target.value;
                          setHowItWorksSteps(u);
                        }}
                        style={{ ...s, resize: "vertical" }}
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSaveHowItWorks}
                  className="btn-sharp"
                  disabled={contentSaving}
                  style={{ alignSelf: "flex-start", padding: "0.7rem 2rem" }}
                >
                  {contentSaving ? "Saving…" : "Save Steps"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── 6. FAQ ── */}
        {activeTab === "faq" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                FAQ Manager
              </h3>
              <button
                type="button"
                className="btn-sharp-outline"
                onClick={() =>
                  setFaqsList([
                    ...faqsList,
                    {
                      id: "faq_" + Date.now(),
                      question: "New Question?",
                      answer: "Answer here.",
                    },
                  ])
                }
              >
                + Add FAQ
              </button>
            </div>
            {contentLoading ? (
              <div style={{ color: "#888" }}>Loading…</div>
            ) : (
              <>
                {faqsList.map((faq, idx) => (
                  <div
                    key={faq.id}
                    style={{
                      border: "2px solid #000",
                      padding: "1.25rem",
                      boxShadow: "3px 3px 0 #000",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <strong>FAQ #{idx + 1}</strong>
                      <button
                        type="button"
                        onClick={() =>
                          setFaqsList(faqsList.filter((f) => f.id !== faq.id))
                        }
                        style={{
                          border: "1px solid #EA4335",
                          color: "#EA4335",
                          background: "none",
                          cursor: "pointer",
                          padding: "0.1rem 0.4rem",
                          fontSize: "0.8rem",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <div style={{ marginBottom: "0.75rem" }}>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Question
                      </label>
                      <input
                        className="input-sharp"
                        value={faq.question}
                        onChange={(e) => {
                          const u = [...faqsList];
                          u[idx].question = e.target.value;
                          setFaqsList(u);
                        }}
                        style={s}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Answer
                      </label>
                      <textarea
                        className="input-sharp"
                        rows={2}
                        value={faq.answer}
                        onChange={(e) => {
                          const u = [...faqsList];
                          u[idx].answer = e.target.value;
                          setFaqsList(u);
                        }}
                        style={{ ...s, resize: "vertical" }}
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSaveFAQs}
                  className="btn-sharp"
                  disabled={contentSaving}
                  style={{ alignSelf: "flex-start", padding: "0.7rem 2rem" }}
                >
                  {contentSaving ? "Saving…" : "Save FAQs"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── 7. HTML TEMPLATES ── */}
        {activeTab === "html templates" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            <div>
              <h3
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  margin: "0 0 0.5rem",
                }}
              >
                Credential HTML Templates
              </h3>
              <p style={{ color: "#666", fontSize: "0.82rem", margin: 0 }}>
                Edit the HTML below. Available variables:{" "}
                <code>{"{{name}}"}</code> <code>{"{{domain}}"}</code>{" "}
                <code>{"{{date}}"}</code> <code>{"{{id}}"}</code>{" "}
                <code>{"{{internId}}"}</code>. When an intern clicks "Download",
                the HTML is auto-filled with their data and a print dialog opens
                — they can save it as a PDF.
              </p>
            </div>
            {contentLoading ? (
              <div style={{ color: "#888" }}>Loading templates…</div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <strong style={{ fontSize: "0.9rem" }}>
                      📄 Offer Letter Template
                    </strong>
                    <textarea
                      rows={22}
                      value={templates.offer_letter}
                      onChange={(e) =>
                        setTemplates({
                          ...templates,
                          offer_letter: e.target.value,
                        })
                      }
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        border: "2px solid #000",
                        padding: "0.5rem",
                        resize: "vertical",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <strong style={{ fontSize: "0.9rem" }}>
                      🏆 Certificate Template
                    </strong>
                    <textarea
                      rows={22}
                      value={templates.certificate}
                      onChange={(e) =>
                        setTemplates({
                          ...templates,
                          certificate: e.target.value,
                        })
                      }
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        border: "2px solid #000",
                        padding: "0.5rem",
                        resize: "vertical",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveTemplates}
                  className="btn-sharp"
                  disabled={contentSaving}
                  style={{ alignSelf: "flex-start", padding: "0.7rem 2rem" }}
                >
                  {contentSaving ? "Saving…" : "Save Templates"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── 8. REFERRALS ── */}
        {activeTab === "referrals" && (
          <>
            {newCode && (
              <div
                style={{
                  border: "2px solid #34A853",
                  padding: "1rem",
                  backgroundColor: "#EBFCEF",
                  color: "#34A853",
                  fontWeight: "bold",
                  marginBottom: "1.5rem",
                }}
              >
                Referral user added. Code: <strong>{newCode}</strong> — Share
                link: <code>/?ref={newCode}</code>
              </div>
            )}
            {data.referrals.length === 0 ? (
              <EmptyBox msg="No referral users yet." />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {data.referrals.map((referral) => (
                  <div
                    key={referral.code || referral.id}
                    style={{
                      border: "2px solid #000",
                      padding: "1.25rem",
                      background: "#fff",
                      boxShadow: "3px 3px 0 #000",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                        flexWrap: "wrap",
                        marginBottom: "1rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 900,
                            color: "#888",
                            textTransform: "uppercase",
                          }}
                        >
                          Referral User
                        </div>
                        <div
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: 900,
                            color: "#000",
                          }}
                        >
                          {referral.name || "-"}
                        </div>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "#555",
                            marginTop: "0.35rem",
                            lineHeight: 1.6,
                          }}
                        >
                          <div>
                            <strong>Code:</strong> {referral.code}
                          </div>
                          <div>
                            <strong>Email:</strong> {referral.email || "-"}
                          </div>
                          <div>
                            <strong>Phone:</strong> {referral.phone || "-"}
                          </div>
                          <div>
                            <strong>City:</strong> {referral.city || "-"}
                          </div>
                          <div>
                            <strong>UPI ID:</strong> {referral.upiId || "-"}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                          alignItems: "flex-end",
                        }}
                      >
                        <code
                          style={{
                            border: "1px solid #ddd",
                            padding: "0.35rem 0.55rem",
                            color: "#000",
                            background: "#fafafa",
                          }}
                        >
                          /?ref={referral.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleDeleteReferral(referral.code)}
                          style={{
                            padding: "0.25rem 0.6rem",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            border: "2px solid #EA4335",
                            background: "#fff",
                            color: "#EA4335",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(130px,1fr))",
                        gap: "0.75rem",
                        marginBottom: "1rem",
                      }}
                    >
                      <ReferralStat
                        label="Link Visits"
                        value={referral.visited || 0}
                      />
                      <ReferralStat
                        label="Assigned Internships"
                        value={referral.assignedInternships || 0}
                      />
                      <ReferralStat
                        label="Completed"
                        value={referral.completedInterns || 0}
                        color="#4285F4"
                      />
                      <ReferralStat
                        label="Completed & Paid"
                        value={referral.completedAndPaidInterns || 0}
                        color="#34A853"
                      />
                      <ReferralStat
                        label="Completed (Not Paid)"
                        value={referral.completedNotPaidInterns || 0}
                        color="#FBBC05"
                      />
                      <ReferralStat
                        label="Logged In"
                        value={referral.totalLogined || 0}
                      />
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(220px,1fr))",
                        gap: "0.75rem",
                      }}
                    >
                      <InternIdList
                        title="Assigned Intern IDs"
                        ids={referral.assignedInternIds}
                      />
                      <InternIdList
                        title="Completed Intern IDs"
                        ids={referral.completedInternIds}
                      />
                      <InternIdList
                        title="Completed & Paid IDs"
                        ids={referral.completedAndPaidInternIds}
                      />
                      <InternIdList
                        title="Completed (Not Paid) IDs"
                        ids={referral.completedNotPaidInternIds}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 9. ADD REFERRAL ── */}
        {activeTab === "add referral" && (
          <form
            onSubmit={handleReferralSubmit}
            style={{
              border: "2px solid #000",
              boxShadow: "4px 4px 0 #000",
              padding: "2rem",
              maxWidth: "520px",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                textTransform: "uppercase",
                margin: "0 0 0.5rem",
              }}
            >
              Add Referral User
            </h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#555",
                margin: "0 0 0.5rem",
                lineHeight: 1.5,
              }}
            >
              A unique referral code is generated automatically after saving.
              Interns who visit via the referral link will be linked to this
              user.
            </p>
            {[
              { key: "name", label: "Full Name", type: "text", required: true },
              { key: "email", label: "Email", type: "email", required: true },
              {
                key: "phone",
                label: "Phone Number",
                type: "tel",
                required: true,
              },
              {
                key: "college",
                label: "College / University",
                type: "text",
                required: true,
              },
              { key: "city", label: "City", type: "text", required: true },
              {
                key: "country",
                label: "Country",
                type: "text",
                required: true,
              },
              {
                key: "upiId",
                label: "UPI ID",
                type: "text",
                required: true,
                placeholder: "name@upi",
              },
            ].map(({ key, label, type, required, placeholder }) => (
              <div key={key}>
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.25rem",
                  }}
                >
                  {label}
                  {required ? " *" : ""}
                </label>
                <input
                  className="input-sharp"
                  type={type}
                  placeholder={placeholder || ""}
                  value={referralForm[key]}
                  onChange={(e) =>
                    setReferralForm({ ...referralForm, [key]: e.target.value })
                  }
                  style={s}
                  required={required}
                />
              </div>
            ))}
            <button
              className="btn-sharp"
              type="submit"
              disabled={referralLoading}
              style={{ marginTop: "0.5rem", padding: "0.7rem" }}
            >
              {referralLoading
                ? "Adding…"
                : "Add Referral User & Generate Code"}
            </button>
          </form>
        )}

        {/* ── 10. VISITS ── */}
        {activeTab === "visits" && (
          <div>
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: "1rem",
              }}
            >
              Referral Link Visits ({data.visits.length})
            </h3>
            <SimpleTable
              empty="No referral visits yet."
              columns={[
                "referralCode",
                "matched",
                "device",
                "country",
                "city",
                "link",
                "visitedAt",
              ]}
              rows={data.visits}
            />
          </div>
        )}

        {/* ── 11. REFERRAL USERS ── */}
        {activeTab === "referral users" && (
          <div>
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: "1.5rem",
              }}
            >
              Referral Users & Their Interns ({referralUsersData.length})
            </h3>
            {referralDataLoading ? (
              <div
                style={{ textAlign: "center", padding: "2rem", color: "#888" }}
              >
                Loading referral users…
              </div>
            ) : referralUsersData.length === 0 ? (
              <EmptyBox msg="No referral users found." />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                {referralUsersData.map((referral) => (
                  <div
                    key={referral.code}
                    style={{
                      border: "2px solid #000",
                      padding: "1.5rem",
                      boxShadow: "4px 4px 0 #000",
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "1rem",
                        marginBottom: "1rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 900,
                            color: "#888",
                            textTransform: "uppercase",
                          }}
                        >
                          Referral User
                        </div>
                        <div
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: 900,
                            color: "#000",
                            marginTop: "0.25rem",
                          }}
                        >
                          {referral.name || "-"}
                        </div>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "#555",
                            marginTop: "0.35rem",
                            lineHeight: 1.6,
                          }}
                        >
                          <div>
                            <strong>Code:</strong> {referral.code}
                          </div>
                          <div>
                            <strong>Email:</strong> {referral.email || "-"}
                          </div>
                          <div>
                            <strong>Phone:</strong> {referral.phone || "-"}
                          </div>
                          <div>
                            <strong>City:</strong> {referral.city || "-"}
                          </div>
                          <div>
                            <strong>UPI ID:</strong> {referral.upiId || "-"}
                          </div>
                          <div>
                            <strong>Last Activity:</strong>{" "}
                            {new Date(
                              referral.lastActivityAt || referral.createdAt,
                            ).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#888",
                            marginBottom: "0.25rem",
                          }}
                        >
                          Interns
                        </div>
                        <div
                          style={{
                            fontSize: "1.4rem",
                            fontWeight: 900,
                            color: "#000",
                          }}
                        >
                          {referral.internCount}
                        </div>
                      </div>
                    </div>

                    {referral.internCount > 0 ? (
                      <div>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            color: "#555",
                            marginBottom: "0.75rem",
                          }}
                        >
                          Assigned Interns ({referral.internIds.length}{" "}
                          {referral.internIds.length === 1
                            ? "Intern"
                            : "Interns"}
                          )
                        </div>
                        {referral.internCount <= 5 ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit,minmax(200px,1fr))",
                              gap: "0.75rem",
                            }}
                          >
                            {referral.interns.map((intern) => (
                              <div
                                key={intern.id}
                                style={{
                                  border: "1px solid #ddd",
                                  padding: "1rem",
                                  background: "#fafafa",
                                  cursor: "pointer",
                                  transition: "all 0.2s",
                                  ":hover": {
                                    borderColor: "#34A853",
                                    boxShadow: "2px 2px 0 #34A853",
                                  },
                                }}
                                onClick={() => setSelectedIntern(intern)}
                              >
                                <div
                                  style={{
                                    fontSize: "0.85rem",
                                    fontWeight: 800,
                                    color: "#000",
                                    marginBottom: "0.5rem",
                                  }}
                                >
                                  {intern.internId || intern.id}
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "#555",
                                    marginBottom: "0.25rem",
                                  }}
                                >
                                  {intern.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#555",
                                    marginBottom: "0.5rem",
                                  }}
                                >
                                  {intern.email}
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.7rem",
                                    color:
                                      intern.status === "Completed"
                                        ? "#34A853"
                                        : intern.status === "Active"
                                          ? "#FBBC05"
                                          : "#888",
                                  }}
                                >
                                  {intern.status}
                                </div>
                                <div
                                  style={{ fontSize: "0.7rem", color: "#888" }}
                                >
                                  {intern.appliedAt
                                    ? `Applied: ${new Date(intern.appliedAt).toLocaleDateString()}`
                                    : ""}
                                </div>
                                {intern.completedAt && (
                                  <div
                                    style={{
                                      fontSize: "0.7rem",
                                      color: "#34A853",
                                      marginTop: "0.25rem",
                                    }}
                                  >
                                    Completed:{" "}
                                    {new Date(
                                      intern.completedAt,
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                                {intern.paymentDate && (
                                  <div
                                    style={{
                                      fontSize: "0.7rem",
                                      color: "#34A853",
                                      marginTop: "0.25rem",
                                    }}
                                  >
                                    Paid:{" "}
                                    {new Date(
                                      intern.paymentDate,
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            style={{
                              border: "1px solid #ddd",
                              borderRadius: "6px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "0.75rem 1rem",
                                background: "#f5f5f5",
                                borderBottom: "1px solid #ddd",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.85rem",
                                  fontWeight: 800,
                                  color: "#000",
                                }}
                              >
                                Interns (showing first 5 of{" "}
                                {referral.internCount})
                              </span>
                              <span
                                style={{ fontSize: "0.75rem", color: "#888" }}
                              >
                                {referral.interns.length} displayed
                              </span>
                            </div>
                            <div
                              style={{ maxHeight: "300px", overflowY: "auto" }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit,minmax(200px,1fr))",
                                  gap: "0.75rem",
                                  padding: "0.75rem",
                                }}
                              >
                                {referral.interns.slice(0, 5).map((intern) => (
                                  <div
                                    key={intern.id}
                                    style={{
                                      border: "1px solid #ddd",
                                      padding: "1rem",
                                      background: "#fafafa",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => setSelectedIntern(intern)}
                                  >
                                    <div
                                      style={{
                                        fontSize: "0.85rem",
                                        fontWeight: 800,
                                        color: "#000",
                                        marginBottom: "0.5rem",
                                      }}
                                    >
                                      {intern.internId || intern.id}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.8rem",
                                        color: "#555",
                                        marginBottom: "0.25rem",
                                      }}
                                    >
                                      {intern.name}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.75rem",
                                        color: "#555",
                                        marginBottom: "0.5rem",
                                      }}
                                    >
                                      {intern.email}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.7rem",
                                        color:
                                          intern.status === "Completed"
                                            ? "#34A853"
                                            : intern.status === "Active"
                                              ? "#FBBC05"
                                              : "#888",
                                      }}
                                    >
                                      {intern.status}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: "1rem",
                          background: "#f8f8f8",
                          border: "1px dashed #ccc",
                          textAlign: "center",
                          color: "#888",
                        }}
                      >
                        No interns assigned yet.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 12. VERIFY WITH AI ── */}
        {activeTab === "verify-ai" && (
          <div
            style={{
              background: "#fff",
              border: "2px solid #000",
              boxShadow: "6px 6px 0 #000",
              padding: "2rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: "1.5rem",
              }}
            >
              Verify with AI
            </h3>
            <p
              style={{
                color: "#666",
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}
            >
              Uses NVIDIA LLM to automatically evaluate intern task submissions.
              The AI reads the task description, reviews the submission, and
              returns a verified/rejected result with feedback.
            </p>

            {(() => {
              // Collect all unverified submissions across all enrollments
              const unverifiedList = [];
              const activeEnrollments = data.requests.filter(
                (e) => e.status !== "Archived",
              );
              activeEnrollments.forEach((enrollment) => {
                const projects = getProjectsForEnrollment(enrollment);
                const submissions = getSubmissions(enrollment);
                projects.forEach((proj, pIdx) => {
                  const sub = submissions[pIdx];
                  if (
                    sub &&
                    sub.submittedAt &&
                    sub.verified !== true &&
                    !sub.resubmit
                  ) {
                    const projTitle =
                      typeof proj === "object" ? proj.title || "" : proj;
                    const projDesc =
                      typeof proj === "object" ? proj.description || "" : "";
                    unverifiedList.push({
                      key: `${enrollment.id}_${pIdx}`,
                      enrollmentId: enrollment.id,
                      projectIndex: pIdx,
                      projectTitle: projTitle,
                      projectDescription: projDesc,
                      internName: enrollment.name,
                      internEmail: enrollment.email,
                      domain: enrollment.domain,
                      submissionText: sub.text || "",
                      submittedAt: sub.submittedAt,
                    });
                  }
                });
              });

              if (unverifiedList.length === 0) {
                return (
                  <div
                    style={{
                      border: "2px dashed #ddd",
                      padding: "3rem",
                      textAlign: "center",
                      background: "#f9f9f9",
                    }}
                  >
                    <h4
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        marginBottom: "1rem",
                        color: "#555",
                      }}
                    >
                      No Pending Submissions
                    </h4>
                    <p style={{ color: "#888" }}>
                      All submissions have been verified. Check back when
                      interns submit new work.
                    </p>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", color: "#555" }}>
                      <strong>{unverifiedList.length}</strong> submission
                      {unverifiedList.length !== 1 ? "s" : ""} pending AI review
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        className="btn-sharp"
                        disabled={verifyingAll || pushingAll}
                        onClick={async () => {
                          setVerifyingAll(true);
                          setAiError("");
                          for (const item of unverifiedList) {
                            const subKey = item.key;
                            if (aiResults[subKey]) continue; // already checked
                            setAiVerifying((prev) => ({
                              ...prev,
                              [subKey]: true,
                            }));
                            try {
                              const res = await verifyTaskWithAI({
                                taskTitle: item.projectTitle,
                                taskDescription: item.projectDescription,
                                submissionText: item.submissionText,
                                internName: item.internName,
                              });
                              if (res.success && res.data) {
                                setAiResults((prev) => ({
                                  ...prev,
                                  [subKey]: res.data,
                                }));
                              }
                            } catch (err) {
                              setAiError(
                                (prev) =>
                                  prev +
                                  `Error for ${item.internName}: ${err.message}\n`,
                              );
                            } finally {
                              setAiVerifying((prev) => ({
                                ...prev,
                                [subKey]: false,
                              }));
                            }
                          }
                          setVerifyingAll(false);
                        }}
                        style={{
                          padding: "0.5rem 1.25rem",
                          fontSize: "0.82rem",
                        }}
                      >
                        {verifyingAll
                          ? "⟳ Running AI on All…"
                          : "▶ Verify All with AI"}
                      </button>

                      {(() => {
                        const allChecked = unverifiedList.every(
                          (item) => !!aiResults[item.key],
                        );
                        const hasAnyResult = unverifiedList.some(
                          (item) => !!aiResults[item.key],
                        );
                        if (!hasAnyResult) return null;
                        return (
                          <button
                            className="btn-sharp"
                            disabled={pushingAll || verifyingAll || !allChecked}
                            onClick={async () => {
                              setPushingAll(true);
                              setAiError("");
                              let successCount = 0;
                              for (const item of unverifiedList) {
                                const result = aiResults[item.key];
                                if (!result) continue;
                                try {
                                  if (result.verified) {
                                    await verifyProject(
                                      item.enrollmentId,
                                      item.projectIndex,
                                    );
                                  } else {
                                    await rejectProject(
                                      item.enrollmentId,
                                      item.projectIndex,
                                      result.message || result.reason,
                                    );
                                  }
                                  setAiResults((prev) => {
                                    const next = { ...prev };
                                    delete next[item.key];
                                    return next;
                                  });
                                  successCount++;
                                } catch (err) {
                                  setAiError(
                                    (prev) =>
                                      prev +
                                      `Push failed for ${item.internName}: ${err.message}\n`,
                                  );
                                }
                              }
                              await loadData();
                              setSuccessMsg(
                                `Pushed ${successCount} AI decision${successCount !== 1 ? "s" : ""} successfully!`,
                              );
                              setPushingAll(false);
                            }}
                            style={{
                              padding: "0.5rem 1.25rem",
                              fontSize: "0.82rem",
                              background: !allChecked ? "#888" : "#1a73e8",
                              borderColor: !allChecked ? "#888" : "#1a73e8",
                            }}
                            title={
                              !allChecked
                                ? 'Run "Verify All" first to check every submission'
                                : "Apply all AI decisions"
                            }
                          >
                            {pushingAll
                              ? "⟳ Pushing…"
                              : "⬆ Push All AI Decisions"}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                  {unverifiedList.map((item) => {
                    const subKey = item.key;
                    const isVerifying = aiVerifying[subKey];
                    const result = aiResults[subKey];

                    return (
                      <div
                        key={subKey}
                        style={{
                          border: "2px solid #000",
                          padding: "1.25rem",
                          background: "#fafafa",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "0.75rem",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: "0.9rem" }}>
                              {item.internName}
                            </strong>
                            <span
                              style={{
                                color: "#888",
                                fontSize: "0.78rem",
                                marginLeft: "0.5rem",
                              }}
                            >
                              {item.internEmail}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "#555",
                              background: "#eee",
                              padding: "0.2rem 0.5rem",
                            }}
                          >
                            {item.domain}
                          </span>
                        </div>

                        <div style={{ marginBottom: "0.5rem" }}>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 900,
                              textTransform: "uppercase",
                              color: "#888",
                            }}
                          >
                            Task #{item.projectIndex + 1}:
                          </span>
                          <span
                            style={{ fontWeight: 700, marginLeft: "0.4rem" }}
                          >
                            {item.projectTitle}
                          </span>
                        </div>
                        {item.projectDescription && (
                          <div
                            style={{
                              fontSize: "0.82rem",
                              color: "#555",
                              marginBottom: "0.5rem",
                            }}
                          >
                            {item.projectDescription}
                          </div>
                        )}

                        <div style={{ marginBottom: "0.75rem" }}>
                          <div
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 900,
                              textTransform: "uppercase",
                              color: "#888",
                              marginBottom: "0.25rem",
                            }}
                          >
                            Submission:
                          </div>
                          <div
                            style={{
                              background: "#fff",
                              border: "1px solid #ddd",
                              padding: "0.6rem",
                              fontSize: "0.82rem",
                              fontFamily: "monospace",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                              maxHeight: "120px",
                              overflow: "auto",
                            }}
                          >
                            {item.submissionText || (
                              <span
                                style={{ color: "#999", fontStyle: "italic" }}
                              >
                                No submission text
                              </span>
                            )}
                          </div>
                        </div>

                        {result && (
                          <div
                            style={{
                              border: `2px solid ${result.verified ? "#34A853" : "#EA4335"}`,
                              background: result.verified
                                ? "#EBFCEF"
                                : "#FFF5F5",
                              padding: "0.75rem",
                              marginBottom: "0.75rem",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                marginBottom: "0.4rem",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  fontWeight: 900,
                                  textTransform: "uppercase",
                                  color: result.verified
                                    ? "#34A853"
                                    : "#EA4335",
                                }}
                              >
                                {result.verified ? "VERIFIED" : "REJECTED"}
                              </span>
                              <span
                                style={{ fontSize: "0.72rem", color: "#888" }}
                              >
                                Confidence: {result.confidence}%
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "0.82rem",
                                color: "#333",
                                marginBottom: "0.3rem",
                              }}
                            >
                              <strong>Reason:</strong> {result.reason}
                            </div>
                            <div style={{ fontSize: "0.82rem", color: "#555" }}>
                              <strong>Message for intern:</strong>{" "}
                              {result.message}
                            </div>
                          </div>
                        )}

                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                          }}
                        >
                          {!result && (
                            <button
                              className="btn-sharp"
                              disabled={isVerifying}
                              onClick={async () => {
                                setAiVerifying((prev) => ({
                                  ...prev,
                                  [subKey]: true,
                                }));
                                setAiError("");
                                try {
                                  const res = await verifyTaskWithAI({
                                    taskTitle: item.projectTitle,
                                    taskDescription: item.projectDescription,
                                    submissionText: item.submissionText,
                                    internName: item.internName,
                                  });
                                  if (res.success && res.data) {
                                    setAiResults((prev) => ({
                                      ...prev,
                                      [subKey]: res.data,
                                    }));
                                  }
                                } catch (err) {
                                  setAiError(err.message);
                                } finally {
                                  setAiVerifying((prev) => ({
                                    ...prev,
                                    [subKey]: false,
                                  }));
                                }
                              }}
                              style={{
                                padding: "0.5rem 1.2rem",
                                fontSize: "0.82rem",
                              }}
                            >
                              {isVerifying ? "⟳ Running AI…" : "Verify with AI"}
                            </button>
                          )}

                          {result && result.verified && (
                            <button
                              className="btn-sharp"
                              style={{
                                background: "#34A853",
                                borderColor: "#34A853",
                                color: "#fff",
                                padding: "0.5rem 1.2rem",
                                fontSize: "0.82rem",
                              }}
                              onClick={async () => {
                                try {
                                  await verifyProject(
                                    item.enrollmentId,
                                    item.projectIndex,
                                  );
                                  setAiResults((prev) => {
                                    const next = { ...prev };
                                    delete next[subKey];
                                    return next;
                                  });
                                  await loadData();
                                  setSuccessMsg(
                                    `${item.internName}'s Task #${item.projectIndex + 1} verified by AI!`,
                                  );
                                } catch (err) {
                                  setError(
                                    "Failed to mark as verified: " +
                                      err.message,
                                  );
                                }
                              }}
                            >
                              ✓ Accept & Mark Verified
                            </button>
                          )}

                          {result && !result.verified && (
                            <button
                              className="btn-sharp-outline"
                              style={{
                                borderColor: "#EA4335",
                                color: "#EA4335",
                                padding: "0.5rem 1.2rem",
                                fontSize: "0.82rem",
                              }}
                              onClick={async () => {
                                try {
                                  await rejectProject(
                                    item.enrollmentId,
                                    item.projectIndex,
                                    result.message || result.reason,
                                  );
                                  setAiResults((prev) => {
                                    const next = { ...prev };
                                    delete next[subKey];
                                    return next;
                                  });
                                  await loadData();
                                  setSuccessMsg(
                                    `Resubmission requested for ${item.internName}'s Task #${item.projectIndex + 1} with AI feedback.`,
                                  );
                                } catch (err) {
                                  setError(
                                    "Failed to send rejection: " + err.message,
                                  );
                                }
                              }}
                            >
                              ✗ Reject & Send Feedback
                            </button>
                          )}

                          {result && (
                            <button
                              style={{
                                border: "1px solid #888",
                                color: "#888",
                                background: "none",
                                cursor: "pointer",
                                padding: "0.5rem 1.2rem",
                                fontSize: "0.82rem",
                              }}
                              onClick={() => {
                                setAiResults((prev) => {
                                  const next = { ...prev };
                                  delete next[subKey];
                                  return next;
                                });
                              }}
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {aiError && (
                    <div
                      style={{
                        border: "2px solid #EA4335",
                        padding: "0.7rem",
                        color: "#EA4335",
                        background: "#FFF5F5",
                        fontSize: "0.85rem",
                      }}
                    >
                      {aiError}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Earn Settings ── */}
        {activeTab === "earn-settings" && (
          <div style={{ maxWidth: "600px" }}>
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: "0.5rem",
              }}
            >
              Earn Section Settings
            </h3>
            <p
              style={{
                color: "#666",
                fontSize: "0.85rem",
                marginBottom: "1.5rem",
              }}
            >
              Configure the reward amounts displayed in the public Refer &amp;
              Earn section.
            </p>
            {earnSettingsLoading ? (
              <div style={{ color: "#888" }}>Loading…</div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                }}
              >
                <div
                  style={{
                    border: "2px solid #000",
                    padding: "1.5rem",
                    boxShadow: "3px 3px 0 #000",
                  }}
                >
                  {[
                    {
                      key: "rewardPerCompletion",
                      label: "Reward per Completion (₹)",
                      type: "number",
                      min: 1,
                    },
                    {
                      key: "milestoneCount",
                      label: "Milestone Count (interns)",
                      type: "number",
                      min: 1,
                    },
                    {
                      key: "milestoneBonus",
                      label: "Milestone Bonus (₹)",
                      type: "number",
                      min: 0,
                    },
                  ].map(({ key, label, type, min }) => (
                    <div key={key} style={{ marginBottom: "1rem" }}>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "block",
                          marginBottom: "0.35rem",
                          textTransform: "uppercase",
                        }}
                      >
                        {label}
                      </label>
                      <input
                        type={type}
                        min={min}
                        value={earnSettings[key]}
                        onChange={(e) =>
                          setEarnSettings((prev) => ({
                            ...prev,
                            [key]: Number(e.target.value),
                          }))
                        }
                        style={s}
                      />
                    </div>
                  ))}
                  <div
                    style={{
                      background: "#f5f5f5",
                      border: "1px solid #ddd",
                      padding: "0.85rem 1rem",
                      fontSize: "0.85rem",
                      marginBottom: "1rem",
                      lineHeight: 1.6,
                    }}
                  >
                    <strong>Preview:</strong> Earn{" "}
                    <strong>₹{earnSettings.rewardPerCompletion}</strong> per
                    referred intern who completes. Bonus of{" "}
                    <strong>₹{earnSettings.milestoneBonus}</strong> when{" "}
                    {earnSettings.milestoneCount} interns complete.
                  </div>
                  <button
                    className="btn-sharp"
                    disabled={earnSettingsSaving}
                    onClick={async () => {
                      setEarnSettingsSaving(true);
                      try {
                        const { saveEarnSettings } =
                          await import("../services/data");
                        await saveEarnSettings(earnSettings);
                        setSuccessMsg("Earn settings saved!");
                        setTimeout(() => setSuccessMsg(""), 3000);
                      } catch (err) {
                        setError(
                          "Failed to save earn settings: " + err.message,
                        );
                      } finally {
                        setEarnSettingsSaving(false);
                      }
                    }}
                    style={{ padding: "0.7rem 2rem" }}
                  >
                    {earnSettingsSaving ? "Saving…" : "Save Settings"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 13. MANAGE ADMINS ── */}
        {activeTab === "manage admins" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.5fr",
              gap: "2rem",
            }}
          >
            <div
              style={{
                border: "2px solid #000",
                padding: "1.75rem",
                boxShadow: "4px 4px 0 #000",
              }}
            >
              <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>
                Authorize New Admin
              </h3>
              <form onSubmit={handleAddAdminSubmit}>
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.35rem",
                  }}
                >
                  Admin Email
                </label>
                <input
                  id="new-admin-email"
                  type="email"
                  placeholder="partner@example.com"
                  className="input-sharp"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  style={s}
                  required
                />
                <button
                  type="submit"
                  className="btn-sharp"
                  style={{ width: "100%", marginTop: "1rem" }}
                  disabled={adminActionLoading}
                >
                  {adminActionLoading ? "Authorizing…" : "Authorize Admin"}
                </button>
              </form>
            </div>
            <div
              style={{
                border: "2px solid #000",
                padding: "1.75rem",
                boxShadow: "4px 4px 0 #000",
              }}
            >
              <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>
                Authorized Admins
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.65rem 0.9rem",
                    background: "#f5f5f5",
                    border: "1px dashed #ccc",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                    rutujdhodapkar@gmail.com
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#888" }}>
                    [ROOT OWNER]
                  </span>
                </div>
                {adminsList.map((email) => (
                  <div
                    key={email}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.65rem 0.9rem",
                      border: "1px solid #ddd",
                    }}
                  >
                    <span style={{ fontSize: "0.85rem" }}>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAdmin(email)}
                      disabled={adminActionLoading}
                      style={{
                        border: "1px solid #EA4335",
                        color: "#EA4335",
                        background: "none",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        padding: "0.15rem 0.5rem",
                        fontWeight: 700,
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── INTERN SUBMISSION DETAIL MODAL ── */}
      {selectedIntern && (
        <div
          onClick={() => setSelectedIntern(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              width: "96%",
              maxWidth: "960px",
              maxHeight: "92vh",
              overflowY: "auto",
              border: "2px solid #000",
              borderRadius: 0,
              position: "relative",
            }}
          >
            {/* Split Header layout: Info Grid on left, Download actions on right */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "7fr 3fr",
                borderBottom: "2px solid #000",
              }}
            >
              {/* Intern Information Block (Left) */}
              <div style={{ padding: "1.75rem 2rem", background: "#fff" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <span
                      style={{
                        background: "#000",
                        color: "#fff",
                        fontSize: "0.68rem",
                        fontWeight: 900,
                        letterSpacing: "2px",
                        padding: "0.2rem 0.6rem",
                        textTransform: "uppercase",
                      }}
                    >
                      Intern Profile
                    </span>
                    <h3
                      style={{
                        margin: "0.35rem 0 0",
                        fontSize: "1.6rem",
                        fontWeight: 900,
                        textTransform: "uppercase",
                      }}
                    >
                      {selectedIntern.name}
                    </h3>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1rem 1.5rem",
                    fontSize: "0.88rem",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 900,
                        color: "#888",
                        textTransform: "uppercase",
                      }}
                    >
                      Intern ID
                    </div>
                    <code style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                      {selectedIntern.internId || selectedIntern.id}
                    </code>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 900,
                        color: "#888",
                        textTransform: "uppercase",
                      }}
                    >
                      College
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {selectedIntern.college || "-"}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 900,
                        color: "#888",
                        textTransform: "uppercase",
                      }}
                    >
                      Email
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {selectedIntern.email}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 900,
                        color: "#888",
                        textTransform: "uppercase",
                      }}
                    >
                      Phone Number
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {selectedIntern.phone || "-"}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 900,
                        color: "#888",
                        textTransform: "uppercase",
                      }}
                    >
                      Domain
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {selectedIntern.domain}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 900,
                        color: "#888",
                        textTransform: "uppercase",
                      }}
                    >
                      Location
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {selectedIntern.city
                        ? `${selectedIntern.city}, ${selectedIntern.country || ""}`
                        : selectedIntern.country || "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Certificate & Letter Downloads (Right side) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  padding: "1.75rem 2rem",
                  background: "#fafafa",
                  borderLeft: "2px solid #000",
                  justifyContent: "center",
                }}
              >
                <h5
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 900,
                    textTransform: "uppercase",
                    color: "#555",
                    marginBottom: "0.25rem",
                  }}
                >
                  Credentials
                </h5>

                <button
                  onClick={() => {
                    const date = new Date(
                      selectedIntern.createdAt,
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    });
                    generateAndPrint(templates.offer_letter, {
                      name: selectedIntern.name,
                      domain: selectedIntern.domain,
                      date,
                      id: selectedIntern.id,
                      internId: selectedIntern.internId || selectedIntern.id,
                    });
                  }}
                  className="btn-sharp-outline"
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.8rem",
                    width: "100%",
                    borderRadius: 0,
                  }}
                >
                  Download Offer Letter
                </button>

                <button
                  onClick={() =>
                    handleToggleCertificateAllow(
                      selectedIntern.id,
                      selectedIntern.allowedCertificate,
                    )
                  }
                  className="btn-sharp"
                  style={{
                    padding: "0.5rem 1rem",
                    fontSize: "0.8rem",
                    width: "100%",
                    borderRadius: 0,
                    backgroundColor:
                      selectedIntern.allowedCertificate === "yes"
                        ? "#EA4335"
                        : "#34A853",
                    border:
                      selectedIntern.allowedCertificate === "yes"
                        ? "2px solid #EA4335"
                        : "2px solid #34A853",
                    color: "#fff",
                  }}
                >
                  {selectedIntern.allowedCertificate === "yes"
                    ? "Lock Certificate"
                    : "Allow Certificate"}
                </button>

                {selectedIntern.allowedCertificate === "yes" && (
                  <button
                    onClick={() => handleGenerateCertificate(selectedIntern)}
                    className="btn-sharp"
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.8rem",
                      width: "100%",
                      borderRadius: 0,
                    }}
                  >
                    Print Certificate
                  </button>
                )}

                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "#555",
                    marginTop: "0.2,rem",
                    textAlign: "center",
                  }}
                >
                  Allowed:{" "}
                  <strong
                    style={{
                      color:
                        selectedIntern.allowedCertificate === "yes"
                          ? "#34A853"
                          : "#EA4335",
                    }}
                  >
                    {selectedIntern.allowedCertificate || "no"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Submissions Task list (Separate boxes for each task) */}
            <div style={{ padding: "2rem" }}>
              <h4
                style={{
                  fontSize: "1rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  marginBottom: "1.25rem",
                  color: "#000",
                }}
              >
                Project Submissions & Reviews
              </h4>

              {(() => {
                const projects = getProjectsForEnrollment(selectedIntern);
                const submissions = getSubmissions(selectedIntern);

                if (projects.length === 0) {
                  return (
                    <div style={{ color: "#888", fontSize: "0.88rem" }}>
                      No projects defined for this domain.
                    </div>
                  );
                }

                return (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.25rem",
                    }}
                  >
                    {projects.map((project, idx) => {
                      const sub = submissions[idx];
                      const isSubmitted = !!sub?.submittedAt;
                      const isVerified = !!sub?.verified;
                      const isResubmit = !!sub?.resubmit;
                      const vKey = `${selectedIntern.id}_${idx}`;
                      const projectTitle =
                        typeof project === "object"
                          ? project.title || project.name || ""
                          : project;
                      const projectDesc =
                        typeof project === "object" ? project.description : "";
                      const projectLinks =
                        typeof project === "object" ? project.links : "";

                      return (
                        <div
                          key={idx}
                          style={{
                            border: isVerified
                              ? "2px solid #34A853"
                              : isResubmit
                                ? "2px solid #EA4335"
                                : isSubmitted
                                  ? "2px solid #FBBC05"
                                  : "1px dashed #ccc",
                            padding: "1.25rem",
                            background: isVerified
                              ? "#f0fdf4"
                              : isResubmit
                                ? "#fff5f5"
                                : isSubmitted
                                  ? "#fffdf0"
                                  : "#fafafa",
                            borderRadius: 0,
                          }}
                        >
                          {/* Header row */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginBottom: "0.75rem",
                              gap: "1rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <span
                                style={{
                                  fontSize: "0.7rem",
                                  fontWeight: 700,
                                  color: "#888",
                                  textTransform: "uppercase",
                                }}
                              >
                                Project {idx + 1}
                              </span>
                              <div
                                style={{
                                  fontWeight: 800,
                                  fontSize: "1rem",
                                  color: "#000",
                                }}
                              >
                                {projectTitle}
                              </div>
                              {projectDesc && (
                                <p
                                  style={{
                                    fontSize: "0.83rem",
                                    color: "#555",
                                    margin: "0.35rem 0 0",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {projectDesc}
                                </p>
                              )}
                              {projectLinks && (
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "#777",
                                    marginTop: "0.3rem",
                                  }}
                                >
                                  <strong>Resources:</strong>{" "}
                                  {projectLinks.split(",").map((l, li) => {
                                    const t = l.trim();
                                    if (!t) return null;
                                    return (
                                      <a
                                        key={li}
                                        href={
                                          t.startsWith("http")
                                            ? t
                                            : `https://${t}`
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          color: "#000",
                                          marginRight: "0.5rem",
                                          fontWeight: 700,
                                        }}
                                      >
                                        Link {li + 1}
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "0.5rem",
                                alignItems: "center",
                                flexShrink: 0,
                              }}
                            >
                              {isVerified && (
                                <span
                                  style={{
                                    background: "#34A853",
                                    color: "#fff",
                                    fontSize: "0.7rem",
                                    fontWeight: 900,
                                    padding: "0.2rem 0.6rem",
                                  }}
                                >
                                  VERIFIED
                                </span>
                              )}
                              {isResubmit && !isSubmitted && (
                                <span
                                  style={{
                                    background: "#EA4335",
                                    color: "#fff",
                                    fontSize: "0.7rem",
                                    fontWeight: 900,
                                    padding: "0.2rem 0.6rem",
                                  }}
                                >
                                  RESUBMIT REQUESTED
                                </span>
                              )}
                              {!isVerified && isSubmitted && (
                                <button
                                  onClick={() =>
                                    handleVerifyProject(selectedIntern.id, idx)
                                  }
                                  disabled={verifyingProject[vKey]}
                                  style={{
                                    padding: "0.3rem 0.85rem",
                                    fontSize: "0.78rem",
                                    fontWeight: 800,
                                    border: "2px solid #34A853",
                                    background: "#34A853",
                                    color: "#fff",
                                    cursor: "pointer",
                                    borderRadius: 0,
                                  }}
                                >
                                  {verifyingProject[vKey]
                                    ? "Verifying…"
                                    : "Verify"}
                                </button>
                              )}
                              {!isVerified && isSubmitted && (
                                <button
                                  onClick={() =>
                                    setShowRejectInput((prev) => ({
                                      ...prev,
                                      [vKey]: !prev[vKey],
                                    }))
                                  }
                                  style={{
                                    padding: "0.3rem 0.85rem",
                                    fontSize: "0.78rem",
                                    fontWeight: 800,
                                    border: "2px solid #EA4335",
                                    background: "#fff",
                                    color: "#EA4335",
                                    cursor: "pointer",
                                    borderRadius: 0,
                                  }}
                                >
                                  Reject / Resubmit
                                </button>
                              )}
                              {!isSubmitted && !isResubmit && (
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "#bbb",
                                    fontStyle: "italic",
                                  }}
                                >
                                  Not yet submitted
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Submission content (read-only) */}
                          {isSubmitted && (
                            <div style={{ marginBottom: "1rem" }}>
                              <div
                                style={{
                                  fontSize: "0.72rem",
                                  color: "#888",
                                  marginBottom: "0.35rem",
                                }}
                              >
                                Submitted:{" "}
                                {new Date(sub.submittedAt).toLocaleString()}
                              </div>
                              <div
                                style={{
                                  padding: "0.65rem 0.85rem",
                                  background: "#fff",
                                  border: "1px solid #ddd",
                                  fontSize: "0.88rem",
                                  color: "#222",
                                  wordBreak: "break-all",
                                  fontFamily: sub.text?.startsWith("http")
                                    ? "monospace"
                                    : "inherit",
                                }}
                              >
                                {sub.text}
                              </div>
                              {isVerified && sub.verifiedAt && (
                                <div
                                  style={{
                                    fontSize: "0.72rem",
                                    color: "#34A853",
                                    marginTop: "0.35rem",
                                  }}
                                >
                                  Verified:{" "}
                                  {new Date(sub.verifiedAt).toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Previous rejection feedback display */}
                          {isResubmit && sub?.feedback && !isSubmitted && (
                            <div
                              style={{
                                padding: "0.6rem 0.85rem",
                                background: "#fff5f5",
                                border: "2px solid #EA4335",
                                fontSize: "0.83rem",
                                color: "#c00",
                                marginBottom: "0.75rem",
                              }}
                            >
                              <strong>Revision Feedback sent to intern:</strong>{" "}
                              {sub.feedback}
                            </div>
                          )}

                          {/* Reject input panel */}
                          {showRejectInput[vKey] && (
                            <div
                              style={{
                                borderTop: "1px solid #e5e5e5",
                                paddingTop: "0.75rem",
                                marginTop: "0.5rem",
                              }}
                            >
                              <label
                                style={{
                                  fontSize: "0.72rem",
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                  display: "block",
                                  marginBottom: "0.35rem",
                                  color: "#EA4335",
                                }}
                              >
                                Rejection Feedback (shown to intern — optional)
                              </label>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.5rem",
                                  alignItems: "flex-end",
                                }}
                              >
                                <textarea
                                  rows={2}
                                  placeholder="Explain what needs to be changed or corrected…"
                                  value={rejectFeedback[vKey] || ""}
                                  onChange={(e) =>
                                    setRejectFeedback((prev) => ({
                                      ...prev,
                                      [vKey]: e.target.value,
                                    }))
                                  }
                                  style={{
                                    flex: 1,
                                    padding: "0.5rem 0.75rem",
                                    border: "2px solid #EA4335",
                                    fontSize: "0.85rem",
                                    outline: "none",
                                    fontFamily: "inherit",
                                    resize: "vertical",
                                    boxSizing: "border-box",
                                    borderRadius: 0,
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRejectProject(selectedIntern.id, idx)
                                  }
                                  disabled={rejectingProject[vKey]}
                                  style={{
                                    padding: "0.55rem 1rem",
                                    fontSize: "0.8rem",
                                    fontWeight: 800,
                                    border: "2px solid #EA4335",
                                    background: "#EA4335",
                                    color: "#fff",
                                    cursor: "pointer",
                                    borderRadius: 0,
                                    whiteSpace: "nowrap",
                                    height: "42px",
                                  }}
                                >
                                  {rejectingProject[vKey]
                                    ? "Requesting…"
                                    : "Request Resubmission"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Footer Actions */}
            <div
              style={{
                padding: "1.25rem 2rem",
                borderTop: "2px solid #000",
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
                flexWrap: "wrap",
                background: "#fafafa",
              }}
            >
              {selectedIntern.transactionId && (
                <div
                  style={{
                    marginRight: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "0.8rem", color: "#333" }}>
                    <strong>Google Pay Transaction ID:</strong>{" "}
                    <code>{selectedIntern.transactionId}</code>
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  await handleStatusToggle(
                    selectedIntern.id,
                    selectedIntern.status,
                  );
                }}
                className="btn-sharp-outline"
                style={{
                  padding: "0.55rem 1.25rem",
                  fontSize: "0.85rem",
                  borderRadius: 0,
                }}
              >
                Toggle Status ({selectedIntern.status} →{" "}
                {selectedIntern.status === "Active" ? "Completed" : "Active"})
              </button>

              <button
                type="button"
                onClick={async () => {
                  await handleArchiveToggle(
                    selectedIntern.id,
                    selectedIntern.status,
                  );
                }}
                className="btn-sharp-outline"
                style={{
                  padding: "0.55rem 1.25rem",
                  fontSize: "0.85rem",
                  borderRadius: 0,
                }}
              >
                {selectedIntern.status === "Archived"
                  ? "Restore Internship"
                  : "Archive Internship"}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDeleteEnrollment(selectedIntern.id, selectedIntern.name)
                }
                style={{
                  padding: "0.55rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  border: "2px solid #EA4335",
                  background: "#fff",
                  color: "#EA4335",
                  cursor: "pointer",
                  borderRadius: 0,
                }}
              >
                Delete Intern
              </button>

              <button
                type="button"
                className="btn-sharp"
                onClick={() => setSelectedIntern(null)}
                style={{
                  padding: "0.55rem 1.5rem",
                  fontSize: "0.85rem",
                  borderRadius: 0,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, color = "#000" }) {
  return (
    <div
      style={{
        border: "2px solid #000",
        padding: "1.25rem 1.5rem",
        boxShadow: "3px 3px 0 #000",
        background: "#fff",
      }}
    >
      <div
        style={{
          fontSize: "0.72rem",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "#888",
          marginBottom: "0.3rem",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function ReferralStat({ label, value, color = "#000" }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        padding: "0.8rem 0.9rem",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          fontSize: "0.68rem",
          textTransform: "uppercase",
          fontWeight: 900,
          color: "#777",
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "1.45rem", fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function InternIdList({ title, ids = [] }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        padding: "0.8rem 0.9rem",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          fontSize: "0.68rem",
          textTransform: "uppercase",
          fontWeight: 900,
          color: "#777",
          marginBottom: "0.5rem",
        }}
      >
        {title}
      </div>
      {ids.length === 0 ? (
        <div style={{ fontSize: "0.8rem", color: "#999" }}>-</div>
      ) : (
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {ids.map((id, idx) => (
            <code
              key={`${id}-${idx}`}
              style={{
                fontSize: "0.75rem",
                color: "#000",
                border: "1px solid #ccc",
                background: "#fff",
                padding: "0.18rem 0.35rem",
              }}
            >
              {id}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyBox({ msg }) {
  return (
    <div
      style={{
        border: "2px dashed #ccc",
        padding: "2.5rem",
        textAlign: "center",
        color: "#aaa",
        fontSize: "0.9rem",
      }}
    >
      {msg}
    </div>
  );
}

function SimpleTable({ columns, rows, empty }) {
  if (!rows.length) return <EmptyBox msg={empty} />;
  return (
    <div
      style={{
        overflowX: "auto",
        border: "2px solid #000",
        boxShadow: "3px 3px 0 #000",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.82rem",
        }}
      >
        <thead>
          <tr style={{ background: "#000", color: "#fff" }}>
            {columns.map((c) => (
              <th key={c} style={th}>
                {c === "selected" ? "Enrolled" : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id || row.code || i}
              style={{
                borderBottom: "1px solid #e0e0e0",
                background: i % 2 === 0 ? "#fafafa" : "#fff",
              }}
            >
              {columns.map((c) => (
                <td key={c} style={td}>
                  {formatCell(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = {
  padding: "0.6rem 0.85rem",
  textAlign: "left",
  fontWeight: 700,
  fontSize: "0.78rem",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  whiteSpace: "nowrap",
  color: "#fff",
};
const td = {
  padding: "0.6rem 0.85rem",
  verticalAlign: "top",
  fontSize: "0.82rem",
  maxWidth: "200px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: "#000",
};

function formatCell(value) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") {
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    return Array.isArray(value) ? value.join(", ") : JSON.stringify(value);
  }
  return String(value);
}
