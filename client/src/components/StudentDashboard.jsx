import React, { useEffect, useState, useRef } from "react";
import {
  fetchUserEnrollments,
  fetchTemplates,
  submitProject,
  submitQuizAnswer,
  fetchEnrollmentById,
  fetchCareerPaths,
  isReferralCodeMatched,
  fetchUserReferralStat,
  fetchReferralDashboardData,
  fetchAdminMessages,
  acknowledgeAdminMessage,
  fetchSiteNotices,
  fetchPaymentMethods,
  autoExpireEnrollments,
  markEnrollmentComplete,
  validateCoupon,
  incrementCouponUsage,
  hideEnrollmentFromUser,
  getHiddenEnrollments,
  unhideEnrollmentFromUser,
} from "../services/data";
import { notify } from "../services/notify";
import { confirmAction } from "../services/confirm";
import EarnSection from "./EarnSection";
import UPIPaymentModal from "./UPIPayment";
import DodoPaymentModal from "./DodoPaymentModal";
import VerifyModal from "./VerifyModal";
import LearnHereModal from "./LearnHereModal";

export default function StudentDashboard({
  user,
  userProfile,
  onExploreClick,
  initialReferralTab,
  onReferralTabConsumed,
  dashboardRefreshKey,
}) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState(null);
  const [careerPaths, setCareerPaths] = useState([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);

  // Submission state: { [enrollmentId_projectIdx]: string }
  const [submissionInputs, setSubmissionInputs] = useState({});
  const [submitting, setSubmitting] = useState({}); // { [key]: bool }
  const [submitSuccess, setSubmitSuccess] = useState({}); // { [key]: bool } — show notice

  // Payment state
  const [referralMatchedMap, setReferralMatchedMap] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentEnrollment, setPaymentEnrollment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null); // 'upi' | 'dodo' | null
  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState({ upi: true, dodo: false });
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0); // percent
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [expandedTaskIdx, setExpandedTaskIdx] = useState(-1);

  const [activeTab, setActiveTab] = useState(initialReferralTab ? "referral" : "overview");
  const [referralStat, setReferralStat] = useState(null);
  const [referralDashData, setReferralDashData] = useState(null);
  const [referralDashLoading, setReferralDashLoading] = useState(false);
  const [tabMessages, setTabMessages] = useState([]);
  const [siteNotices, setSiteNotices] = useState([]);

  const [verifyEnrollment, setVerifyEnrollment] = useState(null);
  const [learnHereDocs, setLearnHereDocs] = useState(null);
  const [learnHereProjectName, setLearnHereProjectName] = useState("");

  // Lock body scroll when payment or profile modals are open
  useEffect(() => {
    if (showPaymentChoice || showPaymentModal) {
      const b = document.body;
      const h = document.documentElement;
      b.style.overflow = 'hidden';
      h.style.overflow = 'hidden';
      b.style.touchAction = 'none';
      h.style.touchAction = 'none';
    } else {
      const b = document.body;
      const h = document.documentElement;
      b.style.overflow = '';
      h.style.overflow = '';
      b.style.touchAction = '';
      h.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.touchAction = '';
    };
  }, [showPaymentChoice, showPaymentModal]);

  const handleOpenPayment = (enrollment, stage) => {
    if (!enrollment?.id) {
      console.error("handleOpenPayment: enrollment missing id", enrollment);
      return;
    }
    setPaymentEnrollment({ ...enrollment, _paymentStage: stage || "full" });
    setPaymentMethod(null);
    setCouponCode("");
    setCouponError("");
    setCouponDiscount(0);
    setShowPaymentChoice(true);
  };

  const getFullAmount = (enrollment) => {
    return enrollment._paymentStage === "start"
      ? (enrollment.paymentStartAmount || Math.round((enrollment.paymentAmount || 99) / 2))
      : (enrollment.paymentEndAmount || enrollment.paymentAmount || 99);
  };

  const getDiscountedAmount = (enrollment) => {
    const full = getFullAmount(enrollment);
    if (couponDiscount <= 0) return full;
    return Math.round(full * (100 - couponDiscount) / 100);
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) { setCouponError("Enter a coupon code."); return; }
    setValidatingCoupon(true);
    setCouponError("");
    try {
      const result = await validateCoupon(code);
      if (result.valid) {
        setCouponDiscount(result.discountPercent);
        setCouponError("");
      } else {
        setCouponDiscount(0);
        setCouponError(result.message);
      }
    } catch (err) {
      setCouponDiscount(0);
      setCouponError("Failed to validate coupon.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (couponCode.trim() && couponDiscount > 0) {
      try { await incrementCouponUsage(couponCode.trim()); } catch (e) { console.warn("incrementCouponUsage:", e.message); }
    }
    setShowPaymentModal(false);
    setShowPaymentChoice(false);
    setPaymentEnrollment(null);
    setPaymentMethod(null);
    setCouponCode("");
    setCouponDiscount(0);
    setCouponError("");
    loadAll();
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      await autoExpireEnrollments();
      const [data, tmpl, cpResult, refStat] = await Promise.all([
        fetchUserEnrollments(user.uid),
        fetchTemplates(),
        fetchCareerPaths(),
        fetchUserReferralStat(user.email),
      ]);
      fetchPaymentMethods().then((pm) => setPaymentMethods(pm)).catch(() => {});
      const hiddenIds = getHiddenEnrollments(user.uid);
      const activeEnrollments = data.filter((e) => e.status !== "Archived").map((e) => ({ ...e, _hidden: hiddenIds.includes(e.id) }));
      setEnrollments(activeEnrollments);
      setTemplates(tmpl?.templates || tmpl || null);
      setCareerPaths(cpResult.paths || []);
      setReferralStat(refStat);

      const matchResults = {};
      await Promise.all(
        activeEnrollments.map(async (enrollment) => {
          if (enrollment.referralCode) {
            matchResults[enrollment.id] = await isReferralCodeMatched(
              enrollment.referralCode,
            );
          }
        }),
      );
      setReferralMatchedMap(matchResults);

      // Auto-select if only 1 enrollment
      if (activeEnrollments.length === 1) {
        setSelectedEnrollment(activeEnrollments[0]);
      }
    } catch (err) {
      setError("Failed to load your internship data.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user, dashboardRefreshKey]);

  // Reset the referral tab flag after consumption
  useEffect(() => {
    if (initialReferralTab && onReferralTabConsumed) {
      onReferralTabConsumed();
    }
  }, []);

  // Switch to referral tab when initialReferralTab becomes true
  useEffect(() => {
    if (initialReferralTab) {
      setActiveTab("referral");
    }
  }, [initialReferralTab]);

  // Load full referral dashboard data when referral tab opens
  useEffect(() => {
    if (activeTab === "referral" && user && !referralDashData && !referralDashLoading) {
      setReferralDashLoading(true);
      fetchReferralDashboardData(user.uid)
        .then((data) => {
          if (data) setReferralDashData(data);
        })
        .catch(() => {})
        .finally(() => setReferralDashLoading(false));
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (!user?.email) return;
    const context = activeTab === "referral" ? "referral" : "intern";
    fetchAdminMessages(user.email, { context, uid: user.uid })
      .then(setTabMessages)
      .catch(() => setTabMessages([]));
  }, [activeTab, user]);

  // Fetch site notices
  useEffect(() => {
    fetchSiteNotices()
      .then((notices) => {
        const context = activeTab === "referral" ? "referral" : "intern";
        setSiteNotices(notices.filter((n) => n.context === "all" || n.context === context));
      })
      .catch(() => setSiteNotices([]));
  }, [activeTab]);

  const handleMessageDone = async (msgId) => {
    try {
      await acknowledgeAdminMessage(msgId, user.uid, {
        email: user.email,
        name: user.displayName,
      });
    } catch {
      /* hide locally even if sync fails */
    }
    setTabMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  const getProjectsForEnrollment = (enrollment) => {
    const path = careerPaths.find(
      (p) => p.id === enrollment.domainId || p.title === enrollment.domain,
    );
    if (path?.projects?.length > 0) {
      return path.projects;
    }
    if (
      enrollment.projects &&
      Array.isArray(enrollment.projects) &&
      enrollment.projects.length > 0
    ) {
      return enrollment.projects;
    }
    return [];
  };

  const getSubmissions = (enrollment) => {
    if (!enrollment.submissions) return {};
    return enrollment.submissions;
  };

  // Pre-fill submission input with previous text if resubmission is requested
  useEffect(() => {
    if (selectedEnrollment) {
      const projects = getProjectsForEnrollment(selectedEnrollment);
      const submissions = getSubmissions(selectedEnrollment);
      const newInputs = {};
      projects.forEach((_, idx) => {
        const sub = submissions[idx];
        if (sub?.resubmit) {
          newInputs[`${selectedEnrollment.id}_${idx}`] = sub.text || "";
        }
      });
      setSubmissionInputs((prev) => ({ ...prev, ...newInputs }));
    }
  }, [selectedEnrollment]);

  /** Refresh a single enrollment after submission */
  const refreshEnrollment = async (enrollmentId) => {
    try {
      const fresh = await fetchEnrollmentById(enrollmentId);
      if (fresh) {
        setEnrollments((prev) =>
          prev.map((e) => (e.id === enrollmentId ? fresh : e)),
        );
        setSelectedEnrollment(fresh);
      }
    } catch (e) {
      console.warn("Refresh failed:", e);
    }
  };

  const getCompletionPercent = (enrollment) => {
    const projects = getProjectsForEnrollment(enrollment);
    if (projects.length === 0) return 0;
    const submissions = getSubmissions(enrollment);
    const verifiedCount = projects.filter(
      (_, idx) => submissions[idx]?.verified,
    ).length;
    return Math.round((verifiedCount / projects.length) * 100);
  };

  const handleSubmitProject = async (enrollment, projectIdx) => {
    const key = `${enrollment.id}_${projectIdx}`;
    const text = (submissionInputs[key] || "").trim();
    if (!text) {
      notify(
        "Please enter your project link or submission text before submitting.",
        "warning",
      );
      return;
    }
    // Guard: block resubmission unless admin marked resubmit
    const subs = getSubmissions(enrollment);
    const existingSub = subs[projectIdx];
    if (existingSub?.submittedAt && !existingSub?.resubmit) {
      notify("This task has already been submitted and is under review. You can only resubmit if the admin requests a revision.", "warning");
      return;
    }
    setSubmitting((prev) => ({ ...prev, [key]: true }));
    try {
      await submitProject(enrollment.id, projectIdx, text);
      await refreshEnrollment(enrollment.id);
      setSubmitSuccess((prev) => ({ ...prev, [key]: true }));
      setSubmissionInputs((prev) => ({ ...prev, [key]: "" }));
      setTimeout(
        () => setSubmitSuccess((prev) => ({ ...prev, [key]: false })),
        6000,
      );
    } catch (err) {
      notify("Submission failed: " + err.message, "error");
    } finally {
      setSubmitting((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSubmitQuiz = async (enrollment, projectIdx, project) => {
    const key = `${enrollment.id}_${projectIdx}`;
    const raw = submissionInputs[key] || "{}";
    let answers;
    try { answers = JSON.parse(raw); } catch { answers = {}; }
    const questions = project?.quizQuestions || [];
    // Check all questions have an answer
    const unanswered = questions.findIndex((q, qi) => {
      const val = answers[qi];
      return val === undefined || String(val).trim() === "";
    });
    if (unanswered !== -1) {
      notify(`Please answer question ${unanswered + 1} before submitting.`, "warning");
      return;
    }
    const subs = getSubmissions(enrollment);
    const existingSub = subs[projectIdx];
    if (existingSub?.submittedAt && !existingSub?.resubmit) {
      notify("This quiz has already been submitted and is under review. You can only resubmit if the admin requests a revision.", "warning");
      return;
    }
    setSubmitting((prev) => ({ ...prev, [key]: true }));
    try {
      await submitQuizAnswer(enrollment.id, projectIdx, answers, project);
      await refreshEnrollment(enrollment.id);
      setSubmitSuccess((prev) => ({ ...prev, [key]: true }));
      setSubmissionInputs((prev) => ({ ...prev, [key]: "" }));
      setTimeout(
        () => setSubmitSuccess((prev) => ({ ...prev, [key]: false })),
        6000,
      );
    } catch (err) {
      notify("Quiz submission failed: " + err.message, "error");
    } finally {
      setSubmitting((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleMarkComplete = async (enrollment) => {
    if (!(await confirmAction("Are you sure you want to mark this internship as complete? This action cannot be undone."))) return;
    try {
      await markEnrollmentComplete(enrollment.id);
      await refreshEnrollment(enrollment.id);
    } catch (err) {
      notify("Failed to mark as complete: " + err.message, "error");
    }
  };

  const handleVerifyInternship = (enrollment) => {
    setVerifyEnrollment(enrollment);
  };

  const openCertificateUrl = (enrollment, templateName) => {
    const id = enrollment.id || enrollment.internId;
    if (!id) { notify("Enrollment ID not found.", "error"); return; }
    const name = templateName.toLowerCase().replace(/\s+/g, "-");
    const url = `${window.location.origin}/certificate/${encodeURIComponent(id)}/${encodeURIComponent(name)}`;
    window.open(url, "_blank");
  };

  const handleDownloadFromTemplate = (enrollment, templateName) => {
    const tLower = templateName.toLowerCase();
    if (tLower.includes("certificate")) {
      const cp = careerPaths.find((p) => p.id === enrollment.domainId || p.title === enrollment.domain);
      const cProjects = cp?.projects?.length > 0
        ? cp.projects
        : (enrollment.projects && Array.isArray(enrollment.projects) && enrollment.projects.length > 0
          ? enrollment.projects
          : []);
      const cSubs = enrollment.submissions || {};
      const allV = cProjects.length > 0 && cProjects.every((_, idx) => cSubs[idx]?.verified);
      const paid = enrollment.paymentStatus === "paid" || enrollment.status === "Completed";
      const unlocked = enrollment.allowedCertificate === "yes" || ((allV || cProjects.length === 0) && paid);
      if (!unlocked) {
        notify("Certificate not unlocked yet.", "error");
        return;
      }
    }
    openCertificateUrl(enrollment, templateName);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <section
      style={{
        backgroundColor: "#f8f8f8",
        minHeight: "calc(100vh - 70px)",
        padding: "5.5rem 1rem 5rem",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Welcome Header with Deadline */}
        <div style={{ border: "2px solid #000", padding: "1rem 1.5rem", background: "#fff", boxShadow: "3px 3px 0 #000", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span style={{ display: "inline-block", backgroundColor: "#000", color: "#fff", fontSize: "0.7rem", fontWeight: 900, letterSpacing: "2px", padding: "0.3rem 0.75rem", marginBottom: "0.5rem", textTransform: "uppercase" }}>INTERN DASHBOARD</span>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 900, textTransform: "uppercase", margin: 0 }}>Welcome, {user.displayName?.split(" ")[0] || "Intern"}</h2>
          </div>
          {enrollments.filter(e => e.status !== "Archived" && e.status !== "Completed").length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", background: "#f5f5f5", padding: "0.75rem 1.25rem", border: "1px solid #ddd" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#000" }}>
                  {(() => {
                    const active = enrollments.filter(e => e.status !== "Archived" && e.status !== "Completed");
                    if (!active.length) return "0";
                    const earliest = active.reduce((min, e) => {
                      const d = e.deadline || e.createdAt;
                      return d < min ? d : min;
                    }, active[0]?.deadline || active[0]?.createdAt);
                    if (!earliest) return "--";
                    const diff = new Date(earliest) - new Date();
                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    return days > 0 ? days : 0;
                  })()}
                </div>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Days Left</div>
              </div>
              <div style={{ flex: 1, minWidth: "120px" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#888", marginBottom: "0.25rem" }}>Progress</div>
                <div style={{ height: "8px", background: "#e0e0e0", border: "1px solid #000", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, (() => {
                    const active = enrollments.filter(e => e.status !== "Archived" && e.status !== "Completed");
                    if (!active.length) return 0;
                    const earliest = active.reduce((min, e) => {
                      const d = e.deadline || e.createdAt;
                      return d < min ? d : min;
                    }, active[0]?.deadline || active[0]?.createdAt);
                    if (!earliest) return 0;
                    const created = new Date(active[0]?.createdAt || Date.now());
                    const deadline = new Date(earliest);
                    const total = deadline - created;
                    const elapsed = Date.now() - created;
                    return total > 0 ? (elapsed / total) * 100 : 0;
                  })()))}%`, background: "#000", transition: "width 0.5s ease" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexDirection: "column" }}>
          {/* Left Sidebar Tabs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", minWidth: 0, width: "100%" }}>
            {[
              { id: "overview", label: "Overview", icon: "\u25C8" },
              { id: "tasks", label: "My Tasks", icon: "\u2630" },
              { id: "referral", label: "Refer & Earn", icon: "\u2197" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "0.65rem 1rem",
                  fontSize: "0.85rem",
                  fontWeight: activeTab === tab.id ? 900 : 700,
                  textTransform: "uppercase",
                  border: "2px solid #000",
                  background: activeTab === tab.id ? "#000" : "#fff",
                  color: activeTab === tab.id ? "#fff" : "#000",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  letterSpacing: "0.5px",
                }}
              >
                <span style={{ fontSize: "1rem" }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, minWidth: 0, width: "100%" }}>

        {error && (
          <div
            style={{
              border: "2px solid #EA4335",
              padding: "1rem",
              backgroundColor: "#FFF5F5",
              color: "#EA4335",
              fontWeight: "bold",
              fontSize: "0.9rem",
              marginBottom: "2rem",
            }}
          >
            {error}
          </div>
        )}

        {tabMessages.length > 0 && (
          <div
            className="student-tab-messages"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              marginBottom: "1.5rem",
            }}
          >
            {tabMessages.map((msg) => {
              const typeStyles = {
                warning: { bg: "#FFF8E1", border: "#FBBC05", color: "#7a5c00" },
                success: { bg: "#E8F5E9", border: "#34A853", color: "#1a5c2e" },
                info: { bg: "#E3F2FD", border: "#4285F4", color: "#1a3a6c" },
                notice: { bg: "#F3E8FF", border: "#9334EA", color: "#4a1a7a" },
              };
              const ts = typeStyles[msg.type] || typeStyles.info;
              const isNotice = msg.type === "notice";
              return (
                <div
                  key={msg.id}
                  style={{
                    border: `2px solid ${ts.border}`,
                    background: ts.bg,
                    padding: "0.85rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, color: ts.color, fontSize: "0.88rem" }}>
                    {msg.title && (
                      <strong style={{ marginRight: "0.5rem" }}>{msg.title}:</strong>
                    )}
                    {msg.text}
                  </div>
                  {!isNotice && (
                    <button
                      type="button"
                      onClick={() => handleMessageDone(msg.id)}
                      style={{
                        background: "#fff",
                        border: `2px solid ${ts.border}`,
                        color: ts.color,
                        fontWeight: 800,
                        fontSize: "0.78rem",
                        padding: "0.35rem 0.85rem",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Done
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Site Notices - always visible boxes */}
        {siteNotices.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              marginBottom: "1.5rem",
            }}
          >
            {siteNotices.map((notice) => {
              const typeStyles = {
                warning: { bg: "#FFF8E1", border: "#FBBC05", color: "#7a5c00" },
                success: { bg: "#E8F5E9", border: "#34A853", color: "#1a5c2e" },
                info: { bg: "#E3F2FD", border: "#4285F4", color: "#1a3a6c" },
              };
              const ts = typeStyles[notice.type] || typeStyles.info;
              return (
                <div
                  key={notice.id}
                  style={{
                    border: `2px solid ${ts.border}`,
                    background: ts.bg,
                    padding: "0.85rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, color: ts.color, fontSize: "0.88rem" }}>
                    {notice.title && (
                      <strong style={{ marginRight: "0.5rem" }}>{notice.title}:</strong>
                    )}
                    {notice.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem",
              color: "#888",
              fontSize: "1.1rem",
            }}
          >
            Loading your internship data…
          </div>
        ) : activeTab === "overview" ? (
          <div>
            <div style={{ border: "2px solid #000", padding: "1.5rem", background: "#fff", boxShadow: "3px 3px 0 #000", marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", marginBottom: "0.5rem" }}>Welcome!</h3>
              <p style={{ color: "#555", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "1rem" }}>
                You have {enrollments.filter(e => e.status !== "Archived").length} internship{enrollments.filter(e => e.status !== "Archived").length !== 1 ? "s" : ""} enrolled.
              </p>
              {enrollments.filter(e => e.status !== "Archived").length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {enrollments.filter(e => e.status !== "Archived").map((e, ei) => {
                    const cp = careerPaths.find((cp) => cp.id === e.domainId || cp.title === e.domain);
                    const buttons = cp?.buttons || [];
                    const beforeBtns = buttons.filter((b) => b.showWhen === "before");
                    const afterBtns = buttons.filter((b) => b.showWhen === "after" && e.status === "Completed");
                    const hasDownloadBtns = beforeBtns.length > 0 || afterBtns.length > 0;
                    const eProjects = getProjectsForEnrollment(e);
                    const eSubs = getSubmissions(e);
                    const eAllVerified = eProjects.length > 0 && eProjects.every((_, idx) => eSubs[idx]?.verified);
                    const eCertUnlocked = e.allowedCertificate === "yes" || ((eAllVerified || eProjects.length === 0) && (e.paymentStatus === "paid" || e.status === "Completed"));
                    return (
                      <div key={ei} style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", border: "1px solid #e0e0e0", padding: "0.75rem 1rem", background: e._hidden ? "#f0f0f0" : "#fafafa", opacity: e._hidden ? 0.6 : 1 }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, minWidth: "140px", textTransform: "uppercase" }}>{e.domain || e.domainId}:</span>
                        <span style={{ fontSize: "0.78rem", color: "#888" }}>Status: {e.status}</span>
                        {e._hidden && <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#999", textTransform: "uppercase", border: "1px solid #ccc", padding: "0.15rem 0.45rem" }}>Hidden</span>}
                        {hasDownloadBtns && beforeBtns.map((btn, bi) => (
                          <button key={`b-${bi}`} className="btn-sharp" onClick={() => handleDownloadFromTemplate(e, btn.templateName)} style={{ padding: "0.4rem 1rem", fontSize: "0.78rem", borderRadius: 0 }}>
                            {btn.label}
                          </button>
                        ))}
                        {hasDownloadBtns && afterBtns.map((btn, bi) => (
                          <button key={`a-${bi}`} className="btn-sharp" onClick={() => handleDownloadFromTemplate(e, btn.templateName)} style={{ padding: "0.4rem 1rem", fontSize: "0.78rem", borderRadius: 0 }}>
                            {btn.label}
                          </button>
                        ))}
                        {eCertUnlocked && !hasDownloadBtns && (
                          <button className="btn-sharp" onClick={() => handleDownloadFromTemplate(e, "Certificate")} style={{ padding: "0.4rem 1rem", fontSize: "0.78rem", borderRadius: 0 }}>
                            Download Certificate
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div style={{ border: "2px solid #000", padding: "1.25rem", background: "#fff", boxShadow: "3px 3px 0 #000", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 900 }}>{enrollments.filter(e => e.status !== "Archived" && e.status !== "Completed").length}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Active Internships</div>
              </div>
              <div style={{ border: "2px solid #000", padding: "1.25rem", background: "#fff", boxShadow: "3px 3px 0 #000", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 900 }}>{enrollments.filter(e => e.status === "Completed").length}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Completed</div>
              </div>
              <div style={{ border: "2px solid #000", padding: "1.25rem", background: "#fff", boxShadow: "3px 3px 0 #000", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 900 }}>{referralStat?.referralCount || 0}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Referrals</div>
              </div>
            </div>
          </div>
        ) : activeTab === "tasks" ? (
          <div>
            {enrollments.length === 0 ? (
              <div style={{ border: "2px solid #000", padding: "2rem", background: "#fff", boxShadow: "3px 3px 0 #000", textAlign: "center" }}>
                <p style={{ color: "#888", fontSize: "1rem" }}>You have no active internships. Explore domains to get started.</p>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: selectedEnrollment ? "1rem" : 0 }}>
                  {enrollments.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        if (selectedEnrollment?.id === e.id) {
                          setSelectedEnrollment(null);
                          setExpandedTaskIdx(-1);
                        } else {
                          setSelectedEnrollment(e);
                          setExpandedTaskIdx(-1);
                        }
                      }}
                      className="btn-sharp"
                      style={{
                        padding: "0.5rem 1rem",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        borderRadius: 0,
                        background: selectedEnrollment?.id === e.id ? "#000" : "#fff",
                        color: selectedEnrollment?.id === e.id ? "#fff" : "#000",
                        border: "2px solid #000",
                        opacity: selectedEnrollment && selectedEnrollment?.id !== e.id ? 0.4 : e._hidden ? 0.6 : 1,
                        transition: "opacity 0.15s",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      {e.domain || e.domainId || "Internship"}
                      {e.status === "Completed" && <span style={{ fontSize: "0.6rem", color: selectedEnrollment?.id === e.id ? "#8f8" : "#080", fontWeight: 800 }}>✓</span>}
                      {e.status === "Expired" && <span style={{ fontSize: "0.6rem", color: selectedEnrollment?.id === e.id ? "#f88" : "#c00", fontWeight: 800 }}>✗</span>}
                      {e._hidden && <span style={{ fontSize: "0.55rem", fontWeight: 600, color: "#999", marginLeft: "0.2rem" }}>HIDDEN</span>}
                    </button>
                  ))}
                </div>
                {selectedEnrollment && (() => {
                  const enrollment = selectedEnrollment;
                  const projects = getProjectsForEnrollment(enrollment);
                  const submissions = getSubmissions(enrollment);
                  const allVerified = projects.length > 0 && projects.every((_, idx) => submissions[idx]?.verified);
                  const isCompleted = enrollment.status === "Completed";
                  const totalTasks = projects.length;
                  const verifiedCount = (Array.isArray(submissions) ? submissions : Object.values(submissions)).filter((s) => s?.verified).length;
                  return (
                    <div style={{ border: "2px solid #000", padding: "1.25rem", background: "#fff", boxShadow: "3px 3px 0 #000", marginBottom: "1.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                        <div>
                          <div style={{ fontSize: "1.1rem", fontWeight: 900, textTransform: "uppercase" }}>{enrollment.domain || enrollment.domainId || "Internship"}</div>
                          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.78rem", color: "#666", fontWeight: 600, marginTop: "0.25rem" }}>
                            <span>Status: <span style={{ color: "#000" }}>{enrollment.status}</span></span>
                            {totalTasks > 0 && <span>{verifiedCount}/{totalTasks} verified</span>}
                            {enrollment.paymentStatus === "paid" && <span style={{ color: "#080" }}>Paid ✓</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          <button
                            className="btn-sharp"
                            onClick={() => { enrollment._hidden ? unhideEnrollmentFromUser(user.uid, enrollment.id) : hideEnrollmentFromUser(user.uid, enrollment.id); loadAll(); notify(enrollment._hidden ? "Internship restored." : "Internship hidden.", "info"); }}
                            style={{ padding: "0.35rem 0.6rem", fontSize: "0.72rem", fontWeight: 600, background: "#fff", color: "#888", cursor: "pointer", borderRadius: 0, border: "2px solid #ccc" }}
                          >
                            {enrollment._hidden ? "Unhide" : "Hide"}
                          </button>
                          <button
                            className="btn-sharp"
                            onClick={() => { setSelectedEnrollment(null); setExpandedTaskIdx(-1); }}
                            style={{ padding: "0.35rem 0.75rem", fontSize: "0.72rem", fontWeight: 600, background: "#fff", color: "#000", cursor: "pointer", borderRadius: 0, border: "2px solid #000" }}
                          >
                            ← All Internships
                          </button>
                        </div>
                      </div>
                      {totalTasks > 0 && (
                        <div style={{ marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Tasks</div>
                          {expandedTaskIdx >= 0 && (
                            <button
                              className="btn-sharp"
                              onClick={() => setExpandedTaskIdx(-1)}
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.68rem", fontWeight: 600, background: "#f5f5f5", color: "#666", cursor: "pointer", borderRadius: 0, border: "1px solid #ccc" }}
                            >
                              Close All
                            </button>
                          )}
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {projects.map((project, idx) => {
                          const submission = submissions[idx];
                          const isVerified = submission?.verified;
                          const isRejected = submission?.status === "rejected";
                          const hasSubmission = submission && (submission.text || submission.fileURL || submission.answer);
                          const isQuiz = project.type === "quiz";
                          const title = project.title || project.name || "";
                          const desc = project.description || "";
                          const isExpanded = expandedTaskIdx === idx;
                          return (
                            <div key={idx} style={{ border: "2px solid #000", background: isExpanded ? "#fafafa" : "#fff" }}>
                              <button
                                onClick={() => setExpandedTaskIdx(isExpanded ? -1 : idx)}
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "0.65rem 0.9rem",
                                  cursor: "pointer",
                                  borderRadius: 0,
                                  border: "none",
                                  background: "transparent",
                                  fontFamily: "inherit",
                                  fontSize: "0.85rem",
                                  textAlign: "left",
                                  gap: "0.75rem",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                                  <span style={{ fontSize: "0.72rem", color: "#999", fontWeight: 600, flexShrink: 0 }}>{isQuiz ? "Q" : "P"}{idx + 1}</span>
                                  <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                                  {isRejected && <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#c00", background: "#fee", padding: "0.2rem 0.45rem", border: "1px solid #c00" }}>REJECTED</span>}
                                  {isVerified && <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#080", background: "#efe", padding: "0.2rem 0.45rem", border: "1px solid #080" }}>VERIFIED ✓</span>}
                                  {!isRejected && !isVerified && hasSubmission && <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#960", background: "#ffe", padding: "0.2rem 0.45rem", border: "1px solid #960" }}>REVIEW</span>}
                                  {!isRejected && !isVerified && !hasSubmission && <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#666", background: "#f5f5f5", padding: "0.2rem 0.45rem", border: "1px solid #ccc" }}>PENDING</span>}
                                  <span style={{ fontSize: "0.7rem", color: "#999", transition: "transform 0.15s", transform: isExpanded ? "rotate(180deg)" : "" }}>▼</span>
                                </div>
                              </button>
                              {isExpanded && (
                                <div style={{ borderTop: "1px solid #ddd", padding: "1rem" }}>
                                  <ProjectBox
                                    enrollment={enrollment}
                                    project={project}
                                    projectName={title}
                                    description={desc}
                                    idx={idx}
                                    submission={submission}
                                    isQuiz={isQuiz}
                                    quizData={project.quizData || project.quiz}
                                    submissionInputs={submissionInputs}
                                    setSubmissionInputs={setSubmissionInputs}
                                    submitting={submitting}
                                    submitSuccess={submitSuccess}
                                    onSubmitProject={handleSubmitProject}
                                    onSubmitQuiz={handleSubmitQuiz}
                                    allVerified={allVerified}
                                    isCompleted={isCompleted}
                                    user={user}
                                    onLearnHere={(docs, name) => { setLearnHereDocs(docs); setLearnHereProjectName(name); }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : activeTab === "referral" ? (
          <div>
            {referralDashData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {!referralDashData.code && (
                  <div style={{ border: "2px solid #000", padding: "1.5rem", background: "#fff", boxShadow: "3px 3px 0 #000", textAlign: "center" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", marginBottom: "1rem" }}>Get Your Referral Code</div>
                    <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: "1rem" }}>Set up your referral code below to start earning rewards.</p>
                    <EarnSection user={user} userProfile={userProfile} onLoginClick={() => {}} />
                  </div>
                )}
                {!userProfile?.upiId && referralDashData.code && (
                  <div style={{ border: "2px solid #FBBC05", background: "#FFF8E1", padding: "0.85rem 1.25rem", fontSize: "0.85rem", color: "#7a5c00" }}>
                    <strong>Add your UPI ID</strong> in the Profile tab to receive referral payouts.
                  </div>
                )}
                {referralDashData.code && (
                <>
                {/* Earnings banner */}
                <div
                  style={{
                    border: "2px solid #000",
                    background: "#EBFCEF",
                    padding: "1rem 1.25rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.88rem",
                      lineHeight: 1.6,
                      color: "#333",
                    }}
                  >
                    Earn <strong>₹{referralDashData?.rewardPerCompletion || 20}</strong> per referred intern who completes
                    their internship, plus a <strong>₹{referralDashData?.milestoneBonus || 1000}</strong> bonus at {referralDashData?.milestoneCount || 50}
                    completions.
                  </div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 900,
                      marginTop: "0.4rem",
                      color: "#34A853",
                    }}
                  >
                    Estimated earnings: ₹
                    {(referralDashData?.completedInterns ?? 0) *
                      (referralDashData?.rewardPerCompletion || 20) +
                      Math.floor(
                        (referralDashData?.completedInterns ?? 0) / (referralDashData?.milestoneCount || 50),
                      ) *
                        (referralDashData?.milestoneBonus || 1000)}
                  </div>
                </div>
                </>
                )}

                {/* Refer User Dashboard */}
                {referralDashData && (
                  <div>
                    <h3
                      style={{
                        fontSize: "1rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        marginBottom: "1rem",
                      }}
                    >
                      Refer User Dashboard ({referralDashData.referredUsers?.length || 0})
                    </h3>
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
                          fontSize: "0.85rem",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#e8e8e8", color: "#000" }}>
                            {[
                              "Name",
                              "Domain Applied",
                              "Status",
                            ].map((h) => (
                              <th
                                key={h}
                                style={{
                                  padding: "0.6rem 0.85rem",
                                  textAlign: "left",
                                  fontWeight: 700,
                                  fontSize: "0.75rem",
                                  textTransform: "uppercase",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {referralDashData.referredUsers?.length > 0 ? referralDashData.referredUsers.map((ru, i) => {
                            const statusColors = {
                              "loggedin": { bg: "#FFF8E1", color: "#7a5c00", label: "Logged In" },
                              "assigned domain": { bg: "#E3F2FD", color: "#1a3a6c", label: "Assigned Domain" },
                              "completed": { bg: "#E8F5E9", color: "#1a5c2e", label: "Completed" },
                              "paid": { bg: "#F3E8FF", color: "#4a1a7a", label: "Paid" },
                            };
                            const sc = statusColors[ru.status] || statusColors["loggedin"];
                            return (
                              <tr
                                key={ru.uid || i}
                                style={{
                                  borderBottom: "1px solid #e0e0e0",
                                  background: i % 2 === 0 ? "#fafafa" : "#fff",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "0.6rem 0.85rem",
                                    fontSize: "0.85rem",
                                  }}
                                >
                                  <strong>{ru.name}</strong>
                                </td>
                                <td
                                  style={{
                                    padding: "0.6rem 0.85rem",
                                    fontSize: "0.82rem",
                                  }}
                                >
                                  {ru.domain}
                                </td>
                                <td style={{ padding: "0.6rem 0.85rem" }}>
                                  <span
                                    style={{
                                      padding: "0.15rem 0.5rem",
                                      fontSize: "0.68rem",
                                      fontWeight: 800,
                                      background: sc.bg,
                                      color: sc.color,
                                      textTransform: "uppercase",
                                      border: `2px solid ${sc.color}`,
                                    }}
                                  >
                                    {sc.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          }) : (
                            <tr>
                              <td colSpan={3} style={{ padding: "1.5rem", textAlign: "center", color: "#aaa", fontSize: "0.85rem" }}>
                                No referred users yet. Share your referral link to get started!
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}


              </div>
              ) : referralDashData?.code ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  {!userProfile?.upiId && (
                    <div style={{ border: "2px solid #FBBC05", background: "#FFF8E1", padding: "0.85rem 1.25rem", fontSize: "0.85rem", color: "#7a5c00" }}>
                      <strong>Add your UPI ID</strong> in the Profile tab to receive referral payouts.
                    </div>
                  )}
                  <div style={{ border: "2px solid #000", padding: "2rem", background: "#fff", boxShadow: "3px 3px 0 #000", textAlign: "center" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 900, textTransform: "uppercase", marginBottom: "0.5rem" }}>No Referral Code Yet</div>
                    <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: "1rem" }}>Create your referral code in the section above to start earning.</p>
                  </div>
                </div>
              ) : (
                <EarnSection
                  user={user}
                  userProfile={userProfile}
                  onLoginClick={() => {}}
                />
              )}
          </div>
        ) : enrollments.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "2px solid #000",
              padding: "3rem",
              textAlign: "center",
              boxShadow: "4px 4px 0 #000",
            }}
          >
            <h3
              style={{
                fontSize: "1.4rem",
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: "1rem",
              }}
            >
              No Active Internships
            </h3>
            <p
              style={{
                color: "#666",
                fontSize: "0.95rem",
                maxWidth: "500px",
                margin: "0 auto 2rem",
                lineHeight: "1.6",
              }}
            >
              You haven\'t enrolled in any internship domains yet. Explore our
              career paths to get started.
            </p>
            <button
              className="btn-sharp"
              onClick={onExploreClick}
              style={{
                padding: "0.6rem 1.5rem",
                fontSize: "0.88rem",
                borderRadius: 0,
              }}
            >
              Explore Programs
            </button>
          </div>
        ) : (
          <div>
            {enrollments.length > 1 && !selectedEnrollment ? (
              <div>
                <h3
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    marginBottom: "1.5rem",
                    color: "#000",
                  }}
                >
                  Select an Internship Dashboard
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "1.5rem",
                  }}
                >
                  {enrollments.map((e) => {
                    const pct = getCompletionPercent(e);
                    const isCompleted = e.status === "Completed";
                    const isExpired = e.status === "Expired";
                    return (
                      <div
                        key={e.id}
                        style={{
                          background: isExpired ? "#1a0000" : "#fff",
                          border: "2px solid #000",
                          padding: "1.5rem",
                          boxShadow: "4px 4px 0 #000",
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <span
                            style={{
                              backgroundColor: isExpired ? "#a00" : isCompleted ? "#34A853" : "#FBBC05",
                              color: "#fff",
                              fontSize: "0.62rem",
                              fontWeight: 900,
                              letterSpacing: "1px",
                              padding: "0.15rem 0.4rem",
                              textTransform: "uppercase",
                            }}
                          >
                            {isExpired ? "✕ EXPIRED" : e.status}
                          </span>
                          <h4
                            style={{
                              fontSize: "1.2rem",
                              fontWeight: 900,
                              textTransform: "uppercase",
                              marginTop: "0.5rem",
                              marginBottom: "0.25rem",
                              color: "#000",
                            }}
                          >
                            {e.domain}
                          </h4>
                          <div style={{ fontSize: "0.72rem", color: "#777" }}>
                            Intern ID: {e.internId || e.id}
                          </div>
                          {e.deadline && !isCompleted && (
                            <div style={{ fontSize: "0.7rem", color: isExpired ? "#ff6666" : "#d32f2f", marginTop: "0.15rem", fontWeight: 700 }}>
                              {isExpired ? "Expired" : "Deadline"}: {new Date(e.deadline).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              marginBottom: "0.25rem",
                              color: "#333",
                            }}
                          >
                            <span>Progress</span>
                            <span>{pct}%</span>
                          </div>
                          <div
                            style={{
                              height: "6px",
                              background: "#e0e0e0",
                              borderRadius: 0,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background: pct === 100 ? "#34A853" : "#FBBC05",
                                borderRadius: 0,
                              }}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-sharp"
                          onClick={() => { setSelectedEnrollment(e); setActiveTab("tasks"); setExpandedTaskIdx(-1); }}
                          style={{
                            padding: "0.5rem",
                            width: "100%",
                            borderRadius: 0,
                            marginTop: "auto",
                            fontSize: "0.85rem",
                          }}
                        >
                          Open Tasks
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
                 )}
      </div>
    </div>
  </div>
      {showPaymentChoice && paymentEnrollment && !paymentMethod && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 2000, overflowY: "auto", padding: "2rem 1rem" }}>
          <div style={{ background: "#fff", border: "3px solid #000", padding: "2rem", width: "90%", maxWidth: "420px", boxShadow: "8px 8px 0 #000", textAlign: "center", marginTop: "2rem" }}>
            <div style={{ height: "6px", background: "#000", marginBottom: "1.5rem", margin: "-2rem -2rem 1.5rem -2rem" }} />
            <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.15rem", marginBottom: "0.5rem" }}>Choose Payment Method</h3>

            {couponDiscount > 0 ? (
              <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1.5rem" }}>
                Amount: <strong>₹{getDiscountedAmount(paymentEnrollment)}</strong>
                <span style={{ textDecoration: "line-through", color: "#aaa", marginLeft: "0.5rem" }}>₹{getFullAmount(paymentEnrollment)}</span>
                <span style={{ color: "#34A853", marginLeft: "0.4rem", fontWeight: 700 }}>({couponDiscount}% off)</span>
              </p>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1.5rem" }}>
                Amount: <strong>₹{getFullAmount(paymentEnrollment)}</strong>
              </p>
            )}

            {/* Coupon Code Input */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", alignItems: "center" }}>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); setCouponDiscount(0); }}
                placeholder="Discount Code"
                disabled={couponDiscount > 0}
                style={{ flex: 1, padding: "0.45rem 0.6rem", border: "2px solid #000", borderRadius: 0, fontSize: "0.85rem", fontFamily: "monospace", fontWeight: 700, textTransform: "uppercase" }}
              />
              {couponDiscount > 0 ? (
                <button onClick={() => { setCouponCode(""); setCouponDiscount(0); setCouponError(""); }} className="btn-sharp" style={{ padding: "0.45rem 0.75rem", fontSize: "0.78rem", background: "#EA4335", color: "#fff", border: "2px solid #c5221f", cursor: "pointer", borderRadius: 0, whiteSpace: "nowrap" }}>
                  Remove
                </button>
              ) : (
                <button onClick={handleApplyCoupon} disabled={validatingCoupon} className="btn-sharp" style={{ padding: "0.45rem 0.75rem", fontSize: "0.78rem", background: "#000", color: "#fff", border: "2px solid #000", cursor: "pointer", borderRadius: 0, whiteSpace: "nowrap" }}>
                  {validatingCoupon ? "..." : "Apply"}
                </button>
              )}
            </div>
            {couponError && <p style={{ fontSize: "0.78rem", color: "#EA4335", marginBottom: "1rem" }}>{couponError}</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(paymentMethods?.upi !== false) && (
                <button onClick={() => { setPaymentMethod("upi"); setShowPaymentChoice(false); setShowPaymentModal(true); }} className="btn-sharp" style={{ padding: "0.85rem", fontSize: "1rem", fontWeight: 800 }}>
                  Pay ₹{getDiscountedAmount(paymentEnrollment)} {couponDiscount > 0 ? "(UPI)" : ""}
                </button>
              )}
              {(paymentMethods?.dodo === true) && (
                <button onClick={() => { setPaymentMethod("dodo"); setShowPaymentChoice(false); setShowPaymentModal(true); }} className="btn-sharp" style={{ padding: "0.85rem", fontSize: "1rem", fontWeight: 800, background: "#000", color: "#fff" }}>
                  Pay ₹{getDiscountedAmount(paymentEnrollment)} {couponDiscount > 0 ? "(Card)" : ""}
                </button>
              )}
            </div>
            <button onClick={() => { setShowPaymentChoice(false); setPaymentEnrollment(null); setCouponCode(""); setCouponDiscount(0); setCouponError(""); }} className="btn-sharp" style={{ marginTop: "1rem", background: "#fff", color: "#000", border: "2px solid #000", padding: "0.5rem 1.5rem", fontSize: "0.82rem" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {showPaymentModal && paymentEnrollment && paymentMethod === "upi" && (
        <UPIPaymentModal
          enrollmentId={paymentEnrollment.id}
          amount={getDiscountedAmount(paymentEnrollment)}
          onSuccess={handlePaymentSuccess}
          onClose={() => { setShowPaymentModal(false); setPaymentEnrollment(null); setPaymentMethod(null); setCouponCode(""); setCouponDiscount(0); setCouponError(""); }}
        />
      )}
      {showPaymentModal && paymentEnrollment && paymentMethod === "dodo" && (
        <DodoPaymentModal
          enrollmentId={paymentEnrollment.id}
          amount={getDiscountedAmount(paymentEnrollment)}
          onSuccess={handlePaymentSuccess}
          onClose={() => { setShowPaymentModal(false); setPaymentEnrollment(null); setPaymentMethod(null); setCouponCode(""); setCouponDiscount(0); setCouponError(""); }}
          userEmail={user?.email}
          userName={user?.displayName}
        />
      )}

      {verifyEnrollment && <VerifyModal enrollment={verifyEnrollment} onClose={() => setVerifyEnrollment(null)} />}
      {learnHereDocs && (
        <LearnHereModal
          documents={learnHereDocs}
          projectName={learnHereProjectName}
          onClose={() => setLearnHereDocs(null)}
        />
      )}
    </section>
  );
}

function EnrollmentCard({
  enrollment,
  projects,
  submissions,
  completionPct,
  allVerified,
  isCompleted,
  isExpired,
  submissionInputs,
  setSubmissionInputs,
  submitting,
  submitSuccess,
  onSubmitProject,
  onSubmitQuiz,
  onDownloadFromTemplate,
  domainButtons,
  onOpenPayment,
  paymentStatus,
  paymentStage,
  paymentAmount,
  paymentStartAmount,
  paymentEndAmount,
  paymentTiming,
  hasMatchedReferral,
  showBackButton,
  onBackClick,
  careerPaths,
  onMarkComplete,
  onVerifyInternship,
  onLearnHere,
}) {
  const domainPath = careerPaths?.find((cp) => cp.id === enrollment.domainId || cp.title === enrollment.domain);
  const displayAmount = domainPath?.paymentAmount || paymentAmount;
  const displayStartAmount = domainPath?.paymentStartAmount || paymentStartAmount;
  const displayEndAmount = domainPath?.paymentEndAmount || paymentEndAmount;
  const verifiedCount = projects.filter(
    (_, idx) => submissions[idx]?.verified,
  ).length;
  const submittedCount = projects.filter(
    (_, idx) => submissions[idx]?.submittedAt,
  ).length;
  // Payment gating logic — default to "end" timing if not set
  const pTiming = paymentTiming || "end";
  const pStatus = paymentStatus || "none";
  const pStage = paymentStage || "none";
  const isStartPaid = pTiming === "start" ? pStatus === "paid" : pTiming === "both" ? (pStage === "start_paid" || pStage === "fully_paid") : true;
  const isEndPaid = pTiming === "both" ? pStage === "fully_paid" : pStatus === "paid";
  const tasksLocked = (pTiming === "start" || pTiming === "both") && !isStartPaid;
  const certUnlocked = enrollment.allowedCertificate === "yes" || ((allVerified || projects.length === 0) && (pStatus === "paid" || isCompleted));

  return (
    <div>
      {showBackButton && (
        <button
          onClick={onBackClick}
          className="btn-sharp"
          style={{
            marginBottom: "1.5rem",
            padding: "0.6rem 1.25rem",
            background: "#fff",
            color: "#000",
            border: "2px solid #000",
            fontWeight: 800,
            cursor: "pointer",
            borderRadius: 0,
            fontSize: "0.85rem",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          ← Back to Internships
        </button>
      )}
      <div
        style={{
          background: "#fff",
          border: "2px solid #000",
          boxShadow: "6px 6px 0 #000",
          overflow: "hidden",
        }}
      >
        {/* Card Header */}
        <div
          style={{
            borderBottom: "2px solid #000",
            padding: "1.75rem 2rem",
            background: isExpired ? "#1a0000" : isCompleted ? "#000" : "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  marginBottom: "0.5rem",
                }}
              >
                <span
                  style={{
                    backgroundColor: isExpired ? "#a00" : isCompleted ? "#34A853" : "#FBBC05",
                    color: "#fff",
                    fontSize: "0.68rem",
                    fontWeight: 900,
                    letterSpacing: "1.5px",
                    padding: "0.2rem 0.6rem",
                    textTransform: "uppercase",
                  }}
                >
                  {isExpired ? "✕ EXPIRED" : isCompleted ? "✓ COMPLETED" : "● ACTIVE"}
                </span>
                <span
                  style={{
                    backgroundColor: isCompleted
                      ? "rgba(255,255,255,0.15)"
                      : "#000",
                    color: "#fff",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    padding: "0.2rem 0.6rem",
                  }}
                >
                  {enrollment.duration}
                </span>
              </div>
              <h3
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  margin: 0,
                  color: isExpired ? "#ff6666" : isCompleted ? "#fff" : "#000",
                }}
              >
                {enrollment.domain}
              </h3>
            </div>

            {/* Intern ID & Referral */}
            <div style={{ textAlign: "right" }}>
              {enrollment.referralCode && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      color: isCompleted ? "rgba(255,255,255,0.6)" : "#888",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Referral ID
                  </div>
                  <code
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      letterSpacing: "1px",
                      color: isCompleted ? "#7affb0" : "#000",
                      background: isCompleted
                        ? "rgba(255,255,255,0.1)"
                        : "#f0f0f0",
                      padding: "0.25rem 0.5rem",
                      border: isCompleted
                        ? "1px solid rgba(255,255,255,0.2)"
                        : "1px solid #ccc",
                    }}
                  >
                    {enrollment.referralCode}
                  </code>
                </div>
              )}
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: isCompleted ? "rgba(255,255,255,0.6)" : "#888",
                  marginBottom: "0.25rem",
                }}
              >
                Intern ID
              </div>
              <code
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  letterSpacing: "1px",
                  color: isCompleted ? "#7affb0" : "#000",
                  background: isCompleted ? "rgba(255,255,255,0.1)" : "#f0f0f0",
                  padding: "0.3rem 0.6rem",
                  border: isCompleted
                    ? "1px solid rgba(255,255,255,0.2)"
                    : "1px solid #ccc",
                }}
              >
                {enrollment.internId || enrollment.id}
              </code>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: isCompleted ? "rgba(255,255,255,0.5)" : "#aaa",
                  marginTop: "0.3rem",
                }}
              >
                Enrolled: {new Date(enrollment.createdAt).toLocaleDateString()}
              </div>
              {enrollment.deadline && !isCompleted && (
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: isExpired ? "#ff6666" : "#d32f2f",
                    marginTop: "0.1rem",
                    fontWeight: 700,
                  }}
                >
                  {isExpired ? "Expired" : "Deadline"}: {new Date(enrollment.deadline).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar with NO rounded corners */}
          <div style={{ marginTop: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.78rem",
                fontWeight: 700,
                marginBottom: "0.4rem",
                color: isCompleted ? "rgba(255,255,255,0.7)" : "#555",
              }}
            >
              <span>Completion Progress</span>
              <span>
                {completionPct}% ({verifiedCount}/{projects.length} verified)
              </span>
            </div>
            <div
              style={{
                height: "8px",
                background: isCompleted ? "rgba(255,255,255,0.2)" : "#e0e0e0",
                borderRadius: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${completionPct}%`,
                  background:
                    completionPct === 100
                      ? "#34A853"
                      : "linear-gradient(90deg, #FBBC05, #f5a700)",
                  borderRadius: 0,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div style={{ padding: "1.75rem 2rem" }}>
          {isExpired && (
            <div style={{ border: "2px solid #a00", padding: "1rem 1.25rem", background: "#2a0000", marginBottom: "1rem" }}>
              <strong style={{ color: "#ff6666" }}>Internship Expired</strong>
              <p style={{ fontSize: "0.85rem", color: "#cc6666", marginTop: "0.35rem" }}>This internship deadline has passed. Contact admin if you need an extension.</p>
            </div>
          )}
          {tasksLocked && (
            <div style={{ border: "2px solid #EA4335", padding: "1rem 1.25rem", background: "#FFF5F5", marginBottom: "1rem" }}>
              <strong style={{ color: "#EA4335" }}>Payment Required</strong>
              <p style={{ fontSize: "0.85rem", color: "#555", marginTop: "0.35rem" }}>Please complete the payment below to unlock your internship tasks.</p>
            </div>
          )}
          <h4
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "1.25rem",
              color: "#000",
            }}
          >
            Project Submissions
          </h4>

          {projects.length === 0 ? (
            <p style={{ color: "#888", fontSize: "0.88rem" }}>
              No projects defined for this domain yet. Check back soon.
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {projects.map((project, idx) => {
                const sub = submissions[idx];
                const key = `${enrollment.id}_${idx}`;
                const isSubmitted = !!sub?.submittedAt;
                const isVerified = !!sub?.verified;
                const isSubmittingNow = submitting[key];
                const showSuccessMsg = submitSuccess[key];
                const isQuiz = (project?.type || "text") === "quiz";

                // Sequential unlock: previous task must be submitted
                let disabled = tasksLocked || isExpired;
                if (idx > 0 && !disabled) {
                  const prev = submissions[idx - 1];
                  const prevProject = projects[idx - 1];
                  const prevIsQuiz = (prevProject?.type || "text") === "quiz";
                  if (prevIsQuiz) {
                    // For quiz, next task requires previous to be verified by admin
                    disabled = !prev?.verified;
                  } else {
                    // For regular tasks, next task requires previous to be submitted
                    disabled = !prev?.submittedAt;
                  }
                }

                const title =
                  typeof project === "object" && project !== null
                    ? project.title || project.name || ""
                    : project;
                const description =
                  typeof project === "object" && project !== null
                    ? project.description
                    : "";
                const rawLinks =
                  typeof project === "object" && project !== null
                    ? project.links
                    : [];
                const normalizeLinks = (raw) => {
                  if (!raw) return [];
                  if (Array.isArray(raw)) {
                    if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null && "items" in raw[0]) return raw;
                    if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null && "url" in raw[0]) return [{ title: "", items: raw.map((l) => ({ text: l.text || "Resource", url: l.url })) }];
                    if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null && "text" in raw[0]) return [{ title: "", items: raw }];
                    return raw;
                  }
                  if (typeof raw === "string" && raw.trim()) {
                    return [{ title: "", items: raw.split(",").map((u) => ({ text: "Resource", url: u.trim() })).filter((l) => l.url) }];
                  }
                  return [];
                };
                const links = normalizeLinks(rawLinks);

                const documents = typeof project === "object" && project !== null ? project.documents || [] : [];

                return (
                  <ProjectBox
                    key={idx}
                    idx={idx}
                    project={project}
                    projectName={title}
                    description={description}
                    links={links}
                    documents={documents}
                    isSubmitted={isSubmitted}
                    isVerified={isVerified}
                    isQuiz={isQuiz}
                    sub={sub}
                    disabled={disabled}
                    inputKey={key}
                    inputValue={submissionInputs[key] || ""}
                    onInputChange={(val) =>
                      setSubmissionInputs((prev) => ({ ...prev, [key]: val }))
                    }
                    onSubmit={() =>
                      isQuiz
                        ? onSubmitQuiz(enrollment, idx, project)
                        : onSubmitProject(enrollment, idx)
                    }
                    isSubmittingNow={isSubmittingNow}
                    showSuccessMsg={showSuccessMsg}
                    onLearnHere={() => onLearnHere && onLearnHere(documents, title)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Certificates Section */}
        <div
          style={{
            padding: "1.25rem 2rem 1.75rem",
            borderTop: "2px solid #e8e8e8",
            background: "#fafafa",
          }}
        >
          {isExpired && (
            <div style={{ border: "2px solid #a00", padding: "1rem 1.25rem", background: "#2a0000", marginBottom: "1rem" }}>
              <strong style={{ color: "#ff6666" }}>Internship Expired</strong>
              <p style={{ fontSize: "0.85rem", color: "#cc6666", marginTop: "0.35rem" }}>Contact admin to discuss reinstatement or extension options.</p>
            </div>
          )}
          <h4
            style={{
              fontSize: "0.85rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "1rem",
              color: "#555",
            }}
          >
            Your Documents
          </h4>

          <div
            style={{ display: "flex", gap: "1rem", flexDirection: "column" }}
          >
              {(() => {
                const beforeBtns = (domainButtons || []).filter((b) => b.showWhen === "before");
                const afterBtns = (domainButtons || []).filter((b) => b.showWhen === "after" && (pStatus === "paid" || isCompleted) && certUnlocked);
                const hasAny = beforeBtns.length > 0 || afterBtns.length > 0;
                return (
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    {beforeBtns.map((btn, bi) => (
                      <button key={bi} className="btn-sharp" onClick={() => onDownloadFromTemplate(enrollment, btn.templateName)} style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem", borderRadius: 0 }}>
                        {btn.label}
                      </button>
                    ))}
                    {afterBtns.map((btn, bi) => (
                      <button key={bi} className="btn-sharp" onClick={() => onDownloadFromTemplate(enrollment, btn.templateName)} style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem", borderRadius: 0 }}>
                        {btn.label}
                      </button>
                    ))}
                    {!hasAny && certUnlocked && (
                      <button className="btn-sharp" onClick={() => onDownloadFromTemplate(enrollment, "Certificate")} style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem", borderRadius: 0 }}>
                        Download Certificate
                      </button>
                    )}
                  </div>
                );
              })()}
              {allVerified && !certUnlocked && (
                <p style={{ fontSize: "0.82rem", color: "#888", fontStyle: "italic" }}>Your certificates are pending admin approval. You will be able to download them once approved.</p>
              )}

            {/* Payment section — always visible, disable when already paid or locked */}
            <div>
              {pTiming === "start" && (
                <div style={{ border: "2px solid #000", padding: "1.5rem", background: "#fff", marginTop: "1rem" }}>
                  <h5 style={{ fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>
                    Payment Required
                  </h5>
                  <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "1rem" }}>
                    {pStatus === "paid" ? "Payment completed." : "Please complete the payment to unlock your internship projects."}
                  </p>
                  <button className="btn-sharp" onClick={() => pStatus !== "paid" && onOpenPayment("start")} disabled={pStatus === "paid"} style={{ padding: "0.75rem 2rem", fontWeight: 800, opacity: pStatus === "paid" ? 0.5 : 1, cursor: pStatus === "paid" ? "not-allowed" : "pointer" }}>
                    {pStatus === "paid" ? "Paid ✓" : `Pay ₹${displayStartAmount || displayAmount || 99}`}
                  </button>
                </div>
              )}
              {pTiming !== "start" && (
                <div style={{ border: "2px solid #000", padding: "1.5rem", background: "#fff", marginTop: "1rem" }}>
                  <h5 style={{ fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>
                    Unlock Completion Certificate
                  </h5>
                  {pStatus === "paid" ? (
                    <div style={{ padding: "1rem", background: "#E8F5E9", border: "2px solid #34A853" }}>
                      <strong style={{ color: "#1a5c2e" }}>Certificate Unlocked</strong>
                      <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>Payment confirmed. You can now download your certificate from the buttons above.</p>
                    </div>
                  ) : (allVerified || projects.length === 0) ? (
                    <div>
                      <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "1rem" }}>
                        Complete the payment to unlock your certificate.
                      </p>
                      <button className="btn-sharp" onClick={() => onOpenPayment("end")} style={{ padding: "0.75rem 2rem", fontWeight: 800 }}>
                        Pay ₹{displayEndAmount || displayAmount || 99}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "1rem" }}>
                        Complete all tasks and get verified to unlock payment.
                      </p>
                      <button className="btn-sharp" disabled style={{ padding: "0.75rem 2rem", fontWeight: 800, opacity: 0.5, cursor: "not-allowed" }}>
                        Pay ₹{displayEndAmount || displayAmount || 99}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {!isCompleted && submittedCount > 0 && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem 1rem",
                background: "#fffbea",
                border: "1px solid #f0d060",
                borderLeft: "4px solid #FBBC05",
                fontSize: "0.82rem",
                color: "#7a6000",
                lineHeight: "1.5",
              }}
            >
              <strong>⏳ Pending Review:</strong> Our team will review your
              submitted project(s) and verify them shortly. Once all projects
              are verified, your Completion Certificate will be unlocked.
            </div>
          )}

          {allVerified && enrollment.transactionId && !isCompleted && (
            <div style={{ marginTop: "1rem", textAlign: "center" }}>
              <button
                onClick={() => onMarkComplete(enrollment)}
                className="btn-sharp"
                style={{
                  padding: "0.85rem 2.5rem",
                  fontSize: "1rem",
                  fontWeight: 900,
                  background: "#34A853",
                  color: "#fff",
                  border: "2px solid #1a5c2e",
                  cursor: "pointer",
                  borderRadius: 0,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Mark as Complete
              </button>
              <p style={{ fontSize: "0.78rem", color: "#777", marginTop: "0.5rem" }}>
                All projects verified and transaction received. Click to finalize.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectBox({
  idx,
  project,
  projectName,
  description,
  links,
  documents,
  isSubmitted,
  isVerified,
  isQuiz,
  sub,
  disabled,
  inputKey,
  inputValue,
  onInputChange,
  onSubmit,
  isSubmittingNow,
  showSuccessMsg,
  onLearnHere,
}) {
  const quizType = project?.quizType || "text";
  const quizOptions = project?.quizOptions || [];
  const borderColor = isVerified
    ? "#34A853"
    : isSubmitted
      ? "#FBBC05"
      : disabled
        ? "#eee"
        : "#ddd";
  const bgColor = isVerified
    ? "#f0fdf4"
    : isSubmitted
          ? "#fffdf0"
          : "#fff";

  return (
    <div
      style={{
        border: `2px solid ${borderColor}`,
        padding: "1.25rem",
        background: bgColor,
        position: "relative",
        transition: "border-color 0.2s",
        borderRadius: 0,
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      {/* Project Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
               background: isVerified
                ? "#34A853"
                : isSubmitted
                  ? "#FBBC05"
                  : disabled
                    ? "#ccc"
                    : "#000",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            {isVerified ? "✓" : idx + 1}
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <strong
              style={{ fontSize: "0.95rem", fontWeight: 800, color: "#000" }}
            >
              {isQuiz ? `Quiz ${idx + 1}: ${projectName}` : `Project ${idx + 1}: ${projectName}`}
            </strong>
            {description && (
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "#555",
                  margin: "0.35rem 0 0.5rem 0",
                  lineHeight: "1.5",
                }}
              >
                {description}
              </p>
            )}
            {links.length > 0 && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#666",
                  marginTop: "0.2rem",
                }}
              >
                <strong>Reference Resources:</strong>
                {links.map((group, gi) => (
                  <div key={gi} style={{ marginTop: "0.25rem" }}>
                    {group.title && (
                      <div style={{ fontWeight: 700, color: "#444", marginBottom: "0.15rem", fontSize: "0.78rem" }}>
                        {group.title}
                      </div>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {(group.items || []).map((item, ii) => {
                        const url = item.url || "";
                        if (!url.trim()) return null;
                        const href = url.startsWith("http") ? url : `https://${url}`;
                        return (
                          <a
                            key={ii}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#000",
                              textDecoration: "underline",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                            }}
                          >
                            {item.text || `Link ${ii + 1}`}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {documents && documents.length > 0 && (
              <button
                onClick={() => onLearnHere && onLearnHere()}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.4rem 1rem",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  background: "#1a1a2e",
                  color: "#fff",
                  border: "2px solid #000",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  fontFamily: "inherit",
                  alignSelf: "flex-start",
                }}
              >
                Learn Here
              </button>
            )}
          </div>
        </div>

        {/* Status Badge */}
        {isVerified && isQuiz && (
          <span
            style={{
              background: "#34A853",
              color: "#fff",
              fontSize: "0.68rem",
              fontWeight: 900,
              letterSpacing: "1px",
              padding: "0.2rem 0.6rem",
              textTransform: "uppercase",
            }}
          >
            ✓ VERIFIED
          </span>
        )}
        {isSubmitted && isQuiz && !isVerified && !sub?.resubmit && (
          <span
            style={{
              background: "#FBBC05",
              color: "#5a4000",
              fontSize: "0.68rem",
              fontWeight: 900,
              letterSpacing: "1px",
              padding: "0.2rem 0.6rem",
              textTransform: "uppercase",
            }}
          >
            SUBMITTED
          </span>
        )}
        {isVerified && !isQuiz && (
          <span
            style={{
              background: "#34A853",
              color: "#fff",
              fontSize: "0.68rem",
              fontWeight: 900,
              letterSpacing: "1px",
              padding: "0.2rem 0.6rem",
              textTransform: "uppercase",
            }}
          >
            ✓ VERIFIED
          </span>
        )}
        {!isVerified && isSubmitted && !isQuiz && !sub?.resubmit && (
          <span
            style={{
              background: "#FBBC05",
              color: "#5a4000",
              fontSize: "0.68rem",
              fontWeight: 900,
              letterSpacing: "1px",
              padding: "0.2rem 0.6rem",
              textTransform: "uppercase",
            }}
          >
            ⏳ SUBMITTED
          </span>
        )}
        {sub?.resubmit && !isVerified && (
          <span
            style={{
              background: "#EA4335",
              color: "#fff",
              fontSize: "0.68rem",
              fontWeight: 900,
              letterSpacing: "1px",
              padding: "0.2rem 0.6rem",
              textTransform: "uppercase",
            }}
          >
            ✏️ REVISION
          </span>
        )}
        {!isSubmitted && !disabled && !isQuiz && (
          <span
            style={{
              background: "#eee",
              color: "#666",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "1px",
              padding: "0.2rem 0.6rem",
              textTransform: "uppercase",
            }}
          >
            PENDING
          </span>
        )}
        {disabled && (
          <span
            style={{
              background: "#ccc",
              color: "#888",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "1px",
              padding: "0.2rem 0.6rem",
              textTransform: "uppercase",
            }}
          >
            LOCKED
          </span>
        )}
      </div>

      {/* Submitted view (read-only) — skip if resubmit requested */}
      {isSubmitted && !sub?.resubmit ? (
        <div>
          {/* Your submission content */}
          <div
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#888",
              marginBottom: "0.35rem",
            }}
          >
            Your Submission
          </div>
          {isQuiz ? (
            <div>
              {(project?.quizQuestions || []).map((q, qi) => {
                const qAnswer = sub?.quizAnswers?.[qi];
                return (
                  <div
                    key={qi}
                    style={{
                      padding: "0.5rem 0.75rem",
                      marginBottom: "0.4rem",
                      background: "#f5f5f5",
                      border: "1px solid #ddd",
                      fontSize: "0.85rem",
                      color: "#333",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: "0.15rem" }}>
                      Q{qi + 1}: {q.question}
                    </div>
                    <div>
                      Your answer: <strong>{qAnswer ?? "(empty)"}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "#f5f5f5",
                border: "1px solid #ddd",
                fontSize: "0.88rem",
                color: "#333",
                wordBreak: "break-all",
                lineHeight: "1.5",
                fontFamily: sub?.text?.startsWith("http") ? "monospace" : "inherit",
              }}
            >
              {sub.text}
            </div>
          )}
          <div style={{ fontSize: "0.72rem", color: "#aaa", marginTop: "0.4rem" }}>
            Submitted: {new Date(sub.submittedAt).toLocaleString()}
            {sub.verified && sub.verifiedAt && (
              <span style={{ color: "#34A853", marginLeft: "1rem" }}>
                ✓ Verified: {new Date(sub.verifiedAt).toLocaleString()}
              </span>
            )}
          </div>

          {/* Prominent Under Review / Verified locked banner */}
          {isVerified ? (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.85rem 1.1rem",
                background: "#f0fdf4",
                border: "2px solid #34A853",
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>✅</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#1a5c2e", textTransform: "uppercase", letterSpacing: "0.5px" }}>Verified by Team</div>
                <div style={{ fontSize: "0.78rem", color: "#2e7d4f", marginTop: "0.15rem" }}>This submission has been approved. Great work!</div>
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.85rem 1.1rem",
                background: "#fffbea",
                border: "2px solid #FBBC05",
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>🔒</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#7a6000", textTransform: "uppercase", letterSpacing: "0.5px" }}>Submitted — Under Review by Team</div>
                <div style={{ fontSize: "0.78rem", color: "#9a7a00", marginTop: "0.15rem" }}>Your submission is locked. You cannot edit or resubmit until our team reviews it.</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Submit form */
        <div>
          {sub?.resubmit && !isVerified && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem 1.25rem",
                backgroundColor: "#fff5f5",
                border: "2px solid #ea4335",
                borderLeft: "6px solid #ea4335",
                color: "#ea4335",
                fontSize: "0.85rem",
                lineHeight: "1.5",
              }}
            >
              <strong>✏️ Revision Requested by Admin</strong>
              {sub?.feedback && (
                <div style={{ marginTop: "0.35rem", fontStyle: "italic" }}>
                  Feedback: {sub.feedback}
                </div>
              )}
            </div>
          )}
          {isQuiz ? (
            <QuizForm
              project={project}
              inputValue={inputValue}
              onInputChange={onInputChange}
              projectName={projectName}
              projectIdx={idx}
            />
          ) : (
            <>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "#666",
                  marginBottom: "0.5rem",
                }}
              >
                Submit your project link or paste your work below:
              </div>
              <textarea
                rows={3}
                placeholder={`Paste your GitHub link, live demo URL, or describe your project submission for "${projectName}"…`}
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  border: "2px solid #ccc",
                  fontSize: "0.88rem",
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  outline: "none",
                  lineHeight: "1.5",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#000")}
                onBlur={(e) => (e.target.style.borderColor = "#ccc")}
              />
            </>
          )}
          <div
            style={{
              marginTop: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={onSubmit}
              disabled={isSubmittingNow || (!isQuiz && !inputValue.trim()) || (isQuiz && !inputValue)}
              className="btn-sharp"
              style={{
                padding: "0.5rem 1.5rem",
                fontSize: "0.85rem",
                opacity: (!inputValue.trim() && !isQuiz) ? 0.5 : 1,
              }}
            >
              {isSubmittingNow ? "Submitting…" : isQuiz ? "Submit All Answers" : "Submit Project"}
            </button>
            {showSuccessMsg && (
              <span
                style={{
                  fontSize: "0.82rem",
                  color: "#34A853",
                  fontWeight: 700,
                }}
              >
                ✓ Submitted successfully! Our team will verify it shortly.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuizForm({ project, inputValue, onInputChange, projectName, isRetry, projectIdx }) {
  const questions = project?.quizQuestions || [];
  const inputRef = useRef(inputValue);
  inputRef.current = inputValue;

  const setAnswer = (qi, val) => {
    const raw = inputRef.current || "{}";
    let cur;
    try { cur = JSON.parse(raw); } catch { cur = {}; }
    onInputChange(JSON.stringify({ ...cur, [qi]: val }));
  };

  if (questions.length === 0) {
    return <p style={{ color: "#888", fontStyle: "italic" }}>No questions configured for this quiz.</p>;
  }

  return (
    <div>
      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: 700,
          textTransform: "uppercase",
          color: "#666",
          marginBottom: "0.75rem",
        }}
      >
        {isRetry ? "Answer all questions again:" : "Answer all questions:"}
      </div>
      {questions.map((q, qi) => {
        const isChecked = (opt) => {
          const raw = inputRef.current || "{}";
          let cur;
          try { cur = JSON.parse(raw); } catch { cur = {}; }
          return cur[qi] === opt;
        };
        return (
        <div
          key={qi}
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            border: "1px solid #ddd",
            background: "#fafafa",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: "0.5rem" }}>
            {qi + 1}. {q.question || `Question ${qi + 1}`}
          </div>

          {q.type === "option" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {(q.options || []).map((opt, oi) => {
                const selected = isChecked(opt);
                return (
                <div
                  key={oi}
                  onClick={() => setAnswer(qi, opt)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.45rem 0.75rem",
                    border: `2px solid ${selected ? "#000" : "#ddd"}`,
                    background: selected ? "#f0f0f0" : "#fff",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: selected ? 700 : 400,
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      border: `2px solid ${selected ? "#000" : "#ccc"}`,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      background: selected ? "#000" : "transparent",
                    }}
                  >
                    {selected && (
                      <span style={{ color: "#fff", fontSize: "12px", lineHeight: 1 }}>✓</span>
                    )}
                  </span>
                  <span>{opt}</span>
                </div>
              );
              })}
            </div>
          ) : q.type === "number" ? (
            <input
              type="number"
              placeholder="Enter your numeric answer…"
              value={(() => { try { const a = JSON.parse(inputRef.current || "{}"); return a[qi] !== undefined ? a[qi] : ""; } catch { return ""; }})()}
              onChange={(e) => setAnswer(qi, e.target.value)}
              style={{
                width: "100%",
                maxWidth: "300px",
                padding: "0.5rem 0.75rem",
                border: "2px solid #ccc",
                fontSize: "0.88rem",
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#000")}
              onBlur={(e) => (e.target.style.borderColor = "#ccc")}
            />
          ) : (
            <input
              type="text"
              placeholder={`Type your answer for question ${qi + 1}…`}
              value={(() => { try { const a = JSON.parse(inputRef.current || "{}"); return a[qi] !== undefined ? a[qi] : ""; } catch { return ""; }})()}
              onChange={(e) => setAnswer(qi, e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "2px solid #ccc",
                fontSize: "0.88rem",
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#000")}
              onBlur={(e) => (e.target.style.borderColor = "#ccc")}
            />
          )}
        </div>
      );})}
    </div>
  );
}
