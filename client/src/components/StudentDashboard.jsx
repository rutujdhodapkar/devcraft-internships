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
  updatePaymentStatus,
} from "../services/data";
import { openCertificatePdf } from "../utils/certificatePdf";
import EarnSection from "./EarnSection";
import StripePaymentModal from "./StripePayment";

/** Generate the HTML document from template + variables and open print dialog */
function generateAndPrint(templateHtml, variables) {
  let html = templateHtml;
  Object.entries(variables).forEach(([k, v]) => {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v || "");
  });
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups to download your document.");
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.print();
  }, 500);
}

export default function StudentDashboard({
  user,
  userProfile,
  onExploreClick,
  initialReferralTab,
  onReferralTabConsumed,
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

  const [activeTab, setActiveTab] = useState(initialReferralTab ? "referral" : "internships");
  const [referralStat, setReferralStat] = useState(null);
  const [referralDashData, setReferralDashData] = useState(null);
  const [referralDashLoading, setReferralDashLoading] = useState(false);
  const [tabMessages, setTabMessages] = useState([]);
  const [siteNotices, setSiteNotices] = useState([]);

  const handleOpenPayment = (enrollment, stage) => {
    if (!enrollment?.id) {
      console.error("handleOpenPayment: enrollment missing id", enrollment);
      return;
    }
    setPaymentEnrollment({ ...enrollment, _paymentStage: stage || "full" });
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);
    if (paymentEnrollment) {
      const stage = paymentEnrollment._paymentStage || "full";
      const timing = paymentEnrollment.paymentTiming || "end";
      let statusPayload = { paymentStatus: "paid", paymentStage: stage };
      if (timing === "both") {
        if (stage === "start") {
          statusPayload = { paymentStatus: "paid", paymentStage: "start_paid" };
        } else {
          statusPayload = { paymentStatus: "paid", paymentStage: "fully_paid" };
        }
      }
      await updatePaymentStatus(paymentEnrollment.id, statusPayload.paymentStatus, statusPayload.paymentStage);
      await refreshEnrollment(paymentEnrollment.id);
    }
    setPaymentEnrollment(null);
  };

  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user]);

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

  // Load full referral dashboard data when referral tab opens and user has a code
  useEffect(() => {
    if (
      activeTab === "referral" &&
      user &&
      referralStat &&
      !referralDashData &&
      !referralDashLoading
    ) {
      setReferralDashLoading(true);
      fetchReferralDashboardData(user.uid)
        .then((data) => {
          if (data) setReferralDashData(data);
        })
        .catch(() => {})
        .finally(() => setReferralDashLoading(false));
    }
  }, [activeTab, user, referralStat]);

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

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [data, tmpl, cpResult, refStat] = await Promise.all([
        fetchUserEnrollments(user.uid),
        fetchTemplates(),
        fetchCareerPaths(),
        fetchUserReferralStat(user.email),
      ]);
      const activeEnrollments = data.filter((e) => e.status !== "Archived");
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
      alert(
        "Please enter your project link or submission text before submitting.",
      );
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
      alert("Submission failed: " + err.message);
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
      alert(`Please answer question ${unanswered + 1} before submitting.`);
      return;
    }
    setSubmitting((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await submitQuizAnswer(enrollment.id, projectIdx, answers, project);
      await refreshEnrollment(enrollment.id);
      setSubmitSuccess((prev) => ({ ...prev, [key]: true }));
      setSubmissionInputs((prev) => ({ ...prev, [key]: "" }));
      setTimeout(
        () => setSubmitSuccess((prev) => ({ ...prev, [key]: false })),
        6000,
      );
    } catch (err) {
      alert("Quiz submission failed: " + err.message);
    } finally {
      setSubmitting((prev) => ({ ...prev, [key]: false }));
    }
  };

  const getTemplate = (name) => (templates && templates[name]) || null;

  const handleDownloadOffer = (enrollment) => {
    const html = getTemplate("Offer Letter");
    if (!html) { alert("Offer letter template not available. Please contact support."); return; }
    generateAndPrint(html, { ...enrollment, date: new Date(enrollment.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) });
  };

  const handleDownloadFromTemplate = (enrollment, templateName) => {
    const html = getTemplate(templateName);
    if (!html) { alert(`Template "${templateName}" not available. Please contact support.`); return; }
    generateAndPrint(html, { ...enrollment, date: new Date(enrollment.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) });
  };

  const handleDownloadCertificate = (enrollment) => {
    openCertificatePdf({
      name: enrollment.name || user.displayName || "Student",
      domain: enrollment.domain,
      date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      id: enrollment.id,
      internId: enrollment.internId || enrollment.id,
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <section
      style={{
        backgroundColor: "#f8f8f8",
        minHeight: "calc(100vh - 70px)",
        padding: "3rem 1rem 5rem",
      }}
    >
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
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
              <span
                style={{
                  display: "inline-block",
                  backgroundColor: "#000",
                  color: "#fff",
                  fontSize: "0.7rem",
                  fontWeight: 900,
                  letterSpacing: "2px",
                  padding: "0.3rem 0.75rem",
                  marginBottom: "0.75rem",
                  textTransform: "uppercase",
                }}
              >
                INTERN DASHBOARD
              </span>
              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  margin: "0 0 0.5rem",
                }}
              >
                Welcome, {user.displayName?.split(" ")[0] || "Intern"} 👋
              </h2>
              <p style={{ color: "#666", fontSize: "0.93rem" }}>
                Manage your active internships, submit your projects, and
                download your credentials.
              </p>
            </div>

            {/* Tabs for Internships & Referrals */}
            <div
              className="student-dashboard-tabs"
              style={{
                display: "flex",
                gap: "0.5rem",
                background: "#e0e0e0",
                padding: "0.3rem",
                border: "2px solid #000",
              }}
            >
              <button
                onClick={() => setActiveTab("internships")}
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  border: "none",
                  background:
                    activeTab === "internships" ? "#000" : "transparent",
                  color: activeTab === "internships" ? "#fff" : "#555",
                  cursor: "pointer",
                }}
              >
                My Internships
              </button>
              <button
                onClick={() => setActiveTab("referral")}
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  border: "none",
                  background:
                    activeTab === "referral" ? "#34A853" : "transparent",
                  color: activeTab === "referral" ? "#fff" : "#555",
                  cursor: "pointer",
                }}
              >
                Refer & Earn
              </button>
            </div>
          </div>
        </div>

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
        ) : activeTab === "referral" ? (
          <div>
            {/* If user already has a referral code, show dashboard. Otherwise show sign-up form */}
            {referralStat ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                {/* Share card */}
                <div
                  style={{
                    border: "2px solid #000",
                    background: "#fff",
                    boxShadow: "6px 6px 0 #000",
                    padding: "1.5rem 2rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#888",
                          marginBottom: "0.3rem",
                        }}
                      >
                        Your Referral Code
                      </div>
                      <div
                        style={{
                          fontSize: "2rem",
                          fontWeight: 900,
                          letterSpacing: "4px",
                          color: "#000",
                        }}
                      >
                        {referralStat.code}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#888",
                          marginBottom: "0.3rem",
                        }}
                      >
                        Share Link
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <code
                          style={{
                            fontSize: "0.82rem",
                            background: "#f5f5f5",
                            padding: "0.4rem 0.7rem",
                            border: "1px solid #ddd",
                            userSelect: "all",
                            wordBreak: "break-all",
                          }}
                        >
                          {window.location.origin}/?ref={referralStat.code}
                        </code>
                        <button
                          className="btn-sharp"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/?ref=${referralStat.code}`,
                            );
                            alert("Referral link copied!");
                          }}
                          style={{
                            padding: "0.4rem 1rem",
                            fontSize: "0.8rem",
                            flexShrink: 0,
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

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
                    Earn <strong>₹20</strong> per referred intern who completes
                    their internship, plus a <strong>₹1,000</strong> bonus at 50
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
                    {(referralDashData?.completedInterns ??
                      referralStat.completedInterns ??
                      0) *
                      20 +
                      Math.floor(
                        (referralDashData?.completedInterns ??
                          referralStat.completedInterns ??
                          0) / 50,
                      ) *
                        1000}
                  </div>
                </div>

                {/* Stats grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {[
                    {
                      label: "Link Visits",
                      value:
                        referralDashData?.totalVisits ??
                        referralStat.visited ??
                        0,
                      color: "#FBBC05",
                    },
                    {
                      label: "Total Logins",
                      value: referralDashData?.totalLogins ?? 0,
                      color: "#4285F4",
                    },
                    {
                      label: "Enrolled Interns",
                      value:
                        referralDashData?.totalEnrolled ??
                        referralStat.assignedInternships ??
                        0,
                      color: "#4285F4",
                    },
                    {
                      label: "Completed",
                      value:
                        referralDashData?.completedInterns ??
                        referralStat.completedInterns ??
                        0,
                      color: "#34A853",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        border: "2px solid #000",
                        padding: "1.25rem 1.5rem",
                        background: "#fff",
                        boxShadow: "3px 3px 0 #000",
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
                        {s.label}
                      </div>
                      <div
                        style={{
                          fontSize: "2rem",
                          fontWeight: 900,
                          color: s.color,
                        }}
                      >
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Loading state for full data */}
                {referralDashLoading && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#888",
                      fontSize: "0.85rem",
                      padding: "0.5rem",
                    }}
                  >
                    Loading full details…
                  </div>
                )}

                {/* Enrolled Interns table */}
                {referralDashData?.enrolledInterns?.length > 0 && (
                  <div>
                    <h3
                      style={{
                        fontSize: "1rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        marginBottom: "1rem",
                      }}
                    >
                      Enrolled Interns ({referralDashData.totalEnrolled})
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
                          <tr style={{ background: "#000", color: "#fff" }}>
                            {[
                              "Name",
                              "Email",
                              "Domain",
                              "College",
                              "Status",
                              "Intern ID",
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
                          {referralDashData.enrolledInterns.map((e, i) => (
                            <tr
                              key={e.id}
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
                                <strong>{e.name}</strong>
                              </td>
                              <td
                                style={{
                                  padding: "0.6rem 0.85rem",
                                  fontSize: "0.82rem",
                                }}
                              >
                                {e.email}
                              </td>
                              <td
                                style={{
                                  padding: "0.6rem 0.85rem",
                                  fontSize: "0.82rem",
                                }}
                              >
                                {e.domain}
                              </td>
                              <td
                                style={{
                                  padding: "0.6rem 0.85rem",
                                  fontSize: "0.82rem",
                                }}
                              >
                                {e.college || "-"}
                              </td>
                              <td style={{ padding: "0.6rem 0.85rem" }}>
                                <span
                                  style={{
                                    padding: "0.15rem 0.5rem",
                                    fontSize: "0.7rem",
                                    fontWeight: 800,
                                    background:
                                      e.status === "Completed"
                                        ? "#34A853"
                                        : e.status === "Archived"
                                          ? "#555"
                                          : "#FBBC05",
                                    color: "#fff",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {e.status}
                                </span>
                              </td>
                              <td style={{ padding: "0.6rem 0.85rem" }}>
                                <code style={{ fontSize: "0.78rem" }}>
                                  {e.internId || e.id?.slice(0, 8)}
                                </code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent visits */}
                {referralDashData?.visits?.length > 0 && (
                  <div>
                    <h3
                      style={{
                        fontSize: "1rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        marginBottom: "1rem",
                      }}
                    >
                      Recent Link Visits
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
                          fontSize: "0.82rem",
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#000", color: "#fff" }}>
                            {[
                              "Date",
                              "Browser",
                              "From",
                              "Link",
                              "Country",
                              "IP",
                              "VPN",
                              "Device",
                            ].map((h) => (
                              <th
                                key={h}
                                style={{
                                  padding: "0.55rem 0.85rem",
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
                          {referralDashData.visits.slice(0, 15).map((v, i) => (
                            <tr
                              key={v.id || i}
                              style={{
                                borderBottom: "1px solid #e0e0e0",
                                background: i % 2 === 0 ? "#fafafa" : "#fff",
                              }}
                            >
                              <td style={{ padding: "0.55rem 0.85rem" }}>
                                {new Date(v.visitedAt).toLocaleString()}
                              </td>
                              <td style={{ padding: "0.55rem 0.85rem" }}>
                                {v.browser || "-"}
                              </td>
                              <td
                                style={{
                                  padding: "0.55rem 0.85rem",
                                  maxWidth: "120px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={v.visitedFrom || v.referrer || ""}
                              >
                                {v.visitedFrom || v.referrer || "Direct"}
                              </td>
                              <td
                                style={{
                                  padding: "0.55rem 0.85rem",
                                  maxWidth: "140px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                title={v.link || ""}
                              >
                                {v.link || "-"}
                              </td>
                              <td style={{ padding: "0.55rem 0.85rem" }}>
                                {v.country || "-"}
                              </td>
                              <td style={{ padding: "0.55rem 0.85rem" }}>
                                {v.ip || "-"}
                              </td>
                              <td style={{ padding: "0.55rem 0.85rem" }}>
                                {v.isVpn === true
                                  ? "Yes"
                                  : v.isVpn === false
                                    ? "No"
                                    : "-"}
                              </td>
                              <td style={{ padding: "0.55rem 0.85rem" }}>
                                {v.device || v.os || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!referralDashLoading &&
                  referralDashData &&
                  referralDashData.enrolledInterns?.length === 0 &&
                  referralDashData.visits?.length === 0 && (
                    <div
                      style={{
                        border: "2px dashed #ccc",
                        padding: "2.5rem",
                        textAlign: "center",
                        color: "#aaa",
                        fontSize: "0.95rem",
                      }}
                    >
                      No activity yet. Share your referral link to get started!
                    </div>
                  )}
              </div>
            ) : (
              /* No code yet → show sign-up form */
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
                    return (
                      <div
                        key={e.id}
                        style={{
                          background: "#fff",
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
                              backgroundColor: isCompleted
                                ? "#34A853"
                                : "#FBBC05",
                              color: "#fff",
                              fontSize: "0.62rem",
                              fontWeight: 900,
                              letterSpacing: "1px",
                              padding: "0.15rem 0.4rem",
                              textTransform: "uppercase",
                            }}
                          >
                            {e.status}
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
                          onClick={() => setSelectedEnrollment(e)}
                          style={{
                            padding: "0.5rem",
                            width: "100%",
                            borderRadius: 0,
                            marginTop: "auto",
                            fontSize: "0.85rem",
                          }}
                        >
                          Open Dashboard
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              (() => {
                const enrollment = selectedEnrollment || enrollments[0];
                const projects = getProjectsForEnrollment(enrollment);
                const submissions = getSubmissions(enrollment);
                const completionPct = getCompletionPercent(enrollment);
                const allVerified =
                  projects.length > 0 &&
                  projects.every((_, idx) => submissions[idx]?.verified);
                const isCompleted = enrollment.status === "Completed";

                return (
                  <EnrollmentCard
                    enrollment={enrollment}
                    projects={projects}
                    submissions={submissions}
                    completionPct={completionPct}
                    allVerified={allVerified}
                    isCompleted={isCompleted}
                    submissionInputs={submissionInputs}
                    setSubmissionInputs={setSubmissionInputs}
                    submitting={submitting}
                    submitSuccess={submitSuccess}
                    onSubmitProject={handleSubmitProject}
                    onSubmitQuiz={handleSubmitQuiz}
                    onDownloadOffer={handleDownloadOffer}
                    onDownloadCertificate={handleDownloadCertificate}
                    onDownloadFromTemplate={handleDownloadFromTemplate}
                    domainButtons={(careerPaths.find((cp) => cp.id === enrollment.domainId) || {}).buttons || []}
                    onOpenPayment={(stage) => handleOpenPayment(enrollment, stage)}
                    paymentStatus={enrollment.paymentStatus}
                    paymentStage={enrollment.paymentStage || "none"}
                    paymentAmount={enrollment.paymentAmount}
                    paymentStartAmount={enrollment.paymentStartAmount}
                    paymentEndAmount={enrollment.paymentEndAmount}
                    paymentTiming={enrollment.paymentTiming}
                    hasMatchedReferral={!!referralMatchedMap[enrollment.id]}
                    showBackButton={enrollments.length > 1}
                    onBackClick={() => setSelectedEnrollment(null)}
                    careerPaths={careerPaths}
                  />
                );
              })()
            )}
          </div>
        )}
      </div>
      {showPaymentModal && paymentEnrollment && (
        <StripePaymentModal
          enrollmentId={paymentEnrollment.id}
          amount={paymentEnrollment._paymentStage === "start" ? (paymentEnrollment.paymentStartAmount || Math.round((paymentEnrollment.paymentAmount || 99) / 2)) : (paymentEnrollment.paymentEndAmount || paymentEnrollment.paymentAmount || 99)}
          paymentStage={paymentEnrollment._paymentStage || "full"}
          onSuccess={handlePaymentSuccess}
          onClose={() => { setShowPaymentModal(false); setPaymentEnrollment(null); }}
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
  submissionInputs,
  setSubmissionInputs,
  submitting,
  submitSuccess,
  onSubmitProject,
  onSubmitQuiz,
  onDownloadOffer,
  onDownloadCertificate,
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
            background: isCompleted ? "#000" : "#fff",
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
                    backgroundColor: isCompleted ? "#34A853" : "#FBBC05",
                    color: "#fff",
                    fontSize: "0.68rem",
                    fontWeight: 900,
                    letterSpacing: "1.5px",
                    padding: "0.2rem 0.6rem",
                    textTransform: "uppercase",
                  }}
                >
                  {isCompleted ? "✓ COMPLETED" : "● ACTIVE"}
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
                  color: isCompleted ? "#fff" : "#000",
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
          {tasksLocked && (
            <div style={{ border: "2px solid #EA4335", padding: "1rem 1.25rem", background: "#FFF5F5", marginBottom: "1rem" }}>
              <strong style={{ color: "#EA4335" }}>🔒 Payment Required</strong>
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
            📋 Project Submissions
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
                let disabled = tasksLocked;
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

                return (
                  <ProjectBox
                    key={idx}
                    idx={idx}
                    project={project}
                    projectName={title}
                    description={description}
                    links={links}
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
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button className="btn-sharp" onClick={() => onDownloadOffer(enrollment)} style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem", borderRadius: 0 }}>
                ⬇ Download Offer Letter
              </button>
              {(domainButtons || []).filter((b) => b.showWhen === "before").map((btn, bi) => (
                <button key={bi} className="btn-sharp" onClick={() => onDownloadFromTemplate(enrollment, btn.templateName)} style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem", borderRadius: 0 }}>
                  {btn.label}
                </button>
              ))}
              {enrollment.allowedCertificate === "yes" ? (
                <button className="btn-sharp" onClick={() => onDownloadCertificate(enrollment)} style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem", backgroundColor: "#34A853", color: "#fff", border: "2px solid #34A853", borderRadius: 0 }}>
                  🏆 Download Certificate
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button disabled style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem", border: "2px solid #ccc", background: "#f5f5f5", color: "#999", cursor: "not-allowed", fontWeight: 700, borderRadius: 0 }}>
                    🔒 Certificate Locked
                  </button>
                  <span style={{ fontSize: "0.75rem", color: "#888" }}>Unlocked after payment & admin approval</span>
                </div>
              )}
              {(domainButtons || []).filter((b) => b.showWhen === "after").map((btn, bi) => (
                <button key={bi} className="btn-sharp" onClick={() => onDownloadFromTemplate(enrollment, btn.templateName)} style={{ padding: "0.6rem 1.5rem", fontSize: "0.85rem", borderRadius: 0 }}>
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Conditional Payment section */}
            {enrollment.allowedCertificate !== "yes" && (
              <div>
                {pTiming === "start" && pStatus !== "paid" && (
                  <div style={{ border: "2px solid #000", padding: "1.5rem", background: "#fff", marginTop: "1rem" }}>
                    <h5 style={{ fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>
                      Payment Required
                    </h5>
                    <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "1rem" }}>
                      Please complete the payment to unlock your internship projects.
                    </p>
                    <button className="btn-sharp" onClick={() => onOpenPayment("start")} style={{ padding: "0.75rem 2rem", fontWeight: 800 }}>
                      Pay ₹{displayStartAmount || displayAmount || 99}
                    </button>
                  </div>
                )}
                {submittedCount === projects.length && projects.length > 0 && (
                  <div style={{ border: "2px solid #000", padding: "1.5rem", background: "#fff", marginTop: "1rem" }}>
                    <h5 style={{ fontSize: "0.95rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>
                      Unlock Completion Certificate
                    </h5>
                    {pStatus === "paid" && allVerified ? (
                      <div style={{ padding: "1rem", background: "#E8F5E9", border: "2px solid #34A853" }}>
                        <strong style={{ color: "#1a5c2e" }}>✓ Certificate Unlocked!</strong>
                        <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>All tasks verified and payment confirmed.</p>
                      </div>
                    ) : pStatus === "paid" && !allVerified ? (
                      <div style={{ padding: "0.75rem 1rem", background: "#fffbea", borderLeft: "4px solid #FBBC05", fontSize: "0.82rem", color: "#7a6000" }}>
                        ⏳ <strong>Waiting for task verification:</strong> Your payment is confirmed. Your certificate will unlock once all your projects are verified by our team.
                      </div>
                    ) : pStatus !== "paid" && (pTiming === "end" || pTiming === "both") ? (
                      <div>
                        <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "1rem" }}>
                          Complete the payment to unlock your certificate.
                        </p>
                        <button className="btn-sharp" onClick={() => onOpenPayment("end")} style={{ padding: "0.75rem 2rem", fontWeight: 800 }}>
                          Pay ₹{displayEndAmount || displayAmount || 99}
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: "0.75rem 1rem", background: "#fffbea", borderLeft: "4px solid #FBBC05", fontSize: "0.82rem", color: "#7a6000" }}>
                        ⏳ Payment not yet completed. Complete payment to unlock your certificate.
                      </div>
                    )}
                  </div>
                )}
                {submittedCount < projects.length && pTiming !== "start" && pStatus !== "paid" && (
                  <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "#f5f5f5", borderLeft: "4px solid #ccc", fontSize: "0.82rem", color: "#666" }}>
                    Complete and submit all <strong>{projects.length}</strong> projects to unlock payment and certificate download.
                  </div>
                )}
              </div>
            )}
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
        {isSubmitted && isQuiz && !isVerified && (
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
        {!isVerified && isSubmitted && !isQuiz && (
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

      {/* Submitted view (read-only) */}
      {isSubmitted ? (
        <div>
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
                fontFamily: sub?.text?.startsWith("http")
                  ? "monospace"
                  : "inherit",
              }}
            >
              {sub.text}
            </div>
          )}
          <div
            style={{ fontSize: "0.72rem", color: "#aaa", marginTop: "0.4rem" }}
          >
            Submitted: {new Date(sub.submittedAt).toLocaleString()}
            {sub.verified && sub.verifiedAt && (
              <span style={{ color: "#34A853", marginLeft: "1rem" }}>
                ✓ Verified: {new Date(sub.verifiedAt).toLocaleString()}
              </span>
            )}
          </div>
          {!isVerified && !isQuiz && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.6rem 0.85rem",
                background: "#fffbea",
                border: "1px solid #f0d060",
                fontSize: "0.78rem",
                color: "#7a6000",
              }}
            >
              📬 Our team will review and verify your submission shortly.
            </div>
          )}
          {!isVerified && isQuiz && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.6rem 0.85rem",
                background: "#fffbea",
                border: "1px solid #f0d060",
                fontSize: "0.78rem",
                color: "#7a6000",
              }}
            >
              📬 Our team will review and verify your submission shortly.
            </div>
          )}
        </div>
      ) : (
        /* Submit form */
        <div>
          {!isVerified && !isSubmitted && sub?.resubmit && !isQuiz && (
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
              <strong
                style={{
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                ⚠️ Revision Requested by Admin
              </strong>
              {sub.feedback ||
                "Please update your submission and submit again."}
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
