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
  saveAdminMessage,
  fetchAllAdminMessages,
  markEnrollmentComplete,
  rejectEnrollmentCompletion,
  clearCompletionRejection,
  autoUnachieveIfActivity,
  overrideCompleteEnrollment,
  unverifyProject,
  unverifyPayment,
  fetchPaymentSettings,
  savePaymentSettings,
  fetchPaymentStats,
  fetchUserTypes,
  saveUserTypes,
  fetchPayoutConfig,
  savePayoutConfig,
  markReferralPayout,
  clearReferralPayout,
  setPaymentAmount,
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
  { id: "verify-completion", label: "Verify Completion" },
  { id: "archived", label: "Archived" },
  { id: "career paths", label: "Domains" },
  { id: "how it works", label: "How It Works" },
  { id: "faq", label: "FAQ" },
  { id: "payment-settings", label: "Payment Settings" },
  { id: "user-types", label: "User Types" },
  { id: "override-validate", label: "Override Validate" },
  { id: "html templates", label: "Templates" },
  { id: "referrals", label: "Referrals" },
  { id: "add referral", label: "+ Add Referral" },
  { id: "visits", label: "Visits" },
  { id: "referral users", label: "Referral Users" },
  { id: "verify-ai", label: "Verify with AI" },
  { id: "earn-settings", label: "Earn Settings" },
  { id: "banned-users", label: "Banned Users" },
  { id: "messages", label: "Messages" },
  { id: "notice-board", label: "Notice Board" },
  { id: "homepage", label: "Homepage" },
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

  // Quiz Editor modal state
  const [quizModalDomainIdx, setQuizModalDomainIdx] = useState(null);
  const [quizModalProjIdx, setQuizModalProjIdx] = useState(null);
  const [quizModalQuestions, setQuizModalQuestions] = useState([]);

  // AI Verification state
  const [aiVerifying, setAiVerifying] = useState({}); // { [subKey]: bool }
  const [aiResults, setAiResults] = useState({}); // { [subKey]: { verified, reason, message, confidence } }
  const [aiError, setAiError] = useState("");
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [pushingAll, setPushingAll] = useState(false);

  // Referrals tab state
  const [referralDateFrom, setReferralDateFrom] = useState("");
  const [referralDateTo, setReferralDateTo] = useState("");
  const [doneReferralCodes, setDoneReferralCodes] = useState(new Set());

  // Earn Settings state
  const [earnSettings, setEarnSettings] = useState({
    rewardPerCompletion: 20,
    milestoneCount: 50,
    milestoneBonus: 1000,
  });
  const [earnSettingsLoading, setEarnSettingsLoading] = useState(false);
  const [earnSettingsSaving, setEarnSettingsSaving] = useState(false);

  // Earn Details state (admin-editable content for EarnSection Details modal)
  const [earnDetails, setEarnDetails] = useState({
    title: "",
    description: "",
    items: [],
  });
  const [earnDetailsLoading, setEarnDetailsLoading] = useState(false);
  const [earnDetailsSaving, setEarnDetailsSaving] = useState(false);

  // Banned Users state
  const [bannedUsers, setBannedUsers] = useState([]);
  const [bannedUsersLoading, setBannedUsersLoading] = useState(false);
  const [banEmail, setBanEmail] = useState("");
  const [banType, setBanType] = useState("both");
  const [banReason, setBanReason] = useState("");
  const [banActionLoading, setBanActionLoading] = useState(false);

  // Admin Messages state
  const [adminMessages, setAdminMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesSaving, setMessagesSaving] = useState(false);
  const [newMessage, setNewMessage] = useState({
    title: "",
    text: "",
    type: "info",
    target: "all",
    expiresAt: "",
  });
  const [quickMessageTarget, setQuickMessageTarget] = useState(null);
  const [quickMessageText, setQuickMessageText] = useState("");
  const [quickMessageSaving, setQuickMessageSaving] = useState(false);

  // Date/Time filter state for all tabs
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterSortBy, setFilterSortBy] = useState("date-desc");
  const [filterInternCountMin, setFilterInternCountMin] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [payoutFilterStatus, setPayoutFilterStatus] = useState("");
  const [payoutDateFrom, setPayoutDateFrom] = useState("");
  const [payoutDateTo, setPayoutDateTo] = useState("");

  // Payment settings state
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [paymentSettingsLoading, setPaymentSettingsLoading] = useState(false);
  const [paymentSettingsSaving, setPaymentSettingsSaving] = useState(false);
  const [paymentStats, setPaymentStats] = useState(null);
  const [payoutConfig, setPayoutConfig] = useState(null);
  const [payoutConfigLoading, setPayoutConfigLoading] = useState(false);
  const [payoutConfigSaving, setPayoutConfigSaving] = useState(false);
  const [userTypes, setUserTypes] = useState([]);
  const [userTypesLoading, setUserTypesLoading] = useState(false);
  const [userTypesSaving, setUserTypesSaving] = useState(false);
  const [overrideSearch, setOverrideSearch] = useState("");

  // Action loading states
  const [actionLoading, setActionLoading] = useState({});

  // Notice Board state
  const [siteNotices, setSiteNotices] = useState([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [newNotice, setNewNotice] = useState({ title: "", text: "", type: "info", context: "all" });
  const [noticeSaving, setNoticeSaving] = useState(false);

  // Homepage content state
  const [homepageContent, setHomepageContent] = useState(null);
  const [homepageLoading, setHomepageLoading] = useState(false);
  const [homepageSaving, setHomepageSaving] = useState(false);

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
      (async () => {
        try {
          const data = await fetchAdminReferralUsersWithInterns();
          // Auto-unachieve any referral with activity after achievedAt
          for (const ref of data) {
            if (ref.achieved) {
              const wasUnachieved = await autoUnachieveIfActivity(ref.code);
              if (wasUnachieved) {
                setSuccessMsg(`${ref.name} auto-unachieved due to new activity.`);
                setTimeout(() => setSuccessMsg(""), 4000);
              }
            }
          }
          if (data.some(r => r.achieved === false && r.autoUnachievedAt)) {
            const fresh = await fetchAdminReferralUsersWithInterns();
            setReferralUsersData(fresh);
          } else {
            setReferralUsersData(data);
          }
        } catch (err) {
          console.warn("Failed to load referral users:", err.message);
        } finally {
          setReferralDataLoading(false);
        }
      })();
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
  const [domainCategories, setDomainCategories] = useState([]);
  const [howItWorksSteps, setHowItWorksSteps] = useState([]);
  const [faqsList, setFaqsList] = useState([]);
  const [templates, setTemplates] = useState({ templates: { "Offer Letter": "", "Certificate": "" }, templateOrder: ["Offer Letter", "Certificate"] });
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
      setEarnDetailsLoading(true);
      import("../services/data").then(({ fetchEarnDetails }) =>
        fetchEarnDetails()
          .then((d) => {
            if (d) setEarnDetails(d);
          })
          .catch(() => {})
          .finally(() => setEarnDetailsLoading(false)),
      );
    }
    if (activeTab === "banned-users") {
      setBannedUsersLoading(true);
      import("../services/data").then(({ fetchBannedUsers }) =>
        fetchBannedUsers()
          .then(setBannedUsers)
          .catch(() => {})
          .finally(() => setBannedUsersLoading(false)),
      );
    }
    if (activeTab === "messages") {
      setMessagesLoading(true);
      import("../services/data").then(({ fetchAllAdminMessages }) =>
        fetchAllAdminMessages()
          .then(setAdminMessages)
          .catch(() => {})
          .finally(() => setMessagesLoading(false)),
      );
    }
    if (activeTab === "notice-board") {
      setNoticesLoading(true);
      import("../services/data").then(({ fetchSiteNotices }) =>
        fetchSiteNotices()
          .then(setSiteNotices)
          .catch(() => {})
          .finally(() => setNoticesLoading(false)),
      );
    }
    if (activeTab === "homepage") {
      setHomepageLoading(true);
      import("../services/data").then(({ fetchHomepageContent }) =>
        fetchHomepageContent()
          .then((data) => setHomepageContent(data || { headline: "", description: "", badges: [], buttons: [], features: [] }))
          .catch(() => setHomepageContent({ headline: "", description: "", badges: [], buttons: [], features: [] }))
          .finally(() => setHomepageLoading(false)),
      );
    }
    if (activeTab === "payment-settings") {
      setPaymentSettingsLoading(true);
      fetchPaymentSettings()
        .then((s) => {
          if (s) setPaymentSettings(s);
        })
        .catch(() => {})
        .finally(() => setPaymentSettingsLoading(false));
      loadPaymentStats();
      setPayoutConfigLoading(true);
      fetchPayoutConfig()
        .then((c) => {
          if (c) setPayoutConfig(c);
        })
        .catch(() => {})
        .finally(() => setPayoutConfigLoading(false));
    }
    if (activeTab === "user-types") {
      setUserTypesLoading(true);
      fetchUserTypes()
        .then((t) => {
          if (t) setUserTypes(t);
        })
        .catch(() => {})
        .finally(() => setUserTypesLoading(false));
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
        const careerData = await fetchCareerPaths();
        if (careerData.paths) {
          setCareerPaths(careerData.paths);
          setDomainCategories(careerData.categories || []);
        } else {
          setCareerPaths(careerData || []);
        }
      } else if (tabName === "how it works") {
        setHowItWorksSteps(JSON.parse(JSON.stringify(await fetchHowItWorks())));
      } else if (tabName === "faq") {
        setFaqsList(JSON.parse(JSON.stringify(await fetchFAQs())));
      } else if (tabName === "html templates") {
        setTemplates(await fetchTemplates() || { templates: { "Offer Letter": "", "Certificate": "" }, templateOrder: ["Offer Letter", "Certificate"] });
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
  const [autoNoticeSaving, setAutoNoticeSaving] = useState({});

  const autoSaveNotice = (pathIdx, pIdx, notice) => {
    const key = `${pathIdx}_${pIdx}`;
    if (noticeTimers.current[key]) clearTimeout(noticeTimers.current[key]);
    noticeTimers.current[key] = setTimeout(async () => {
      setAutoNoticeSaving((prev) => ({ ...prev, [key]: true }));
      try {
        await saveCareerPaths(careerPaths);
        setAutoNoticeSaving((prev) => ({ ...prev, [key]: false }));
      } catch (err) {
        setAutoNoticeSaving((prev) => ({ ...prev, [key]: false }));
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
      setSuccessMsg("Don't Verify - Resubmission requested.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Failed to request resubmission: " + err.message);
    } finally {
      setRejectingProject((prev) => ({ ...prev, [key]: false }));
    }
  };
  const handleVerifyPayment = async (enrollmentId) => {
    if (!window.confirm(`Verify payment for this intern?`)) return;
    const key = `verify-pay-${enrollmentId}`;
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      await updatePaymentStatus(enrollmentId, "paid", "full");
      await loadData();
      setSuccessMsg("Payment verified.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Verify payment failed: " + err.message);
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
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
      await saveCareerPaths(careerPaths, domainCategories);
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

  const handleSavePaymentSettings = async () => {
    setPaymentSettingsSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      await savePaymentSettings(paymentSettings);
      setSuccessMsg("Payment settings saved!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Failed to save payment settings: " + err.message);
    } finally {
      setPaymentSettingsSaving(false);
    }
  };

  const loadPaymentStats = async () => {
    try {
      const stats = await fetchPaymentStats();
      setPaymentStats(stats);
    } catch (err) {
      console.error("Failed to load payment stats:", err);
    }
  };

  const handleSavePayoutConfig = async () => {
    setPayoutConfigSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      await savePayoutConfig(payoutConfig);
      setSuccessMsg("Payout config saved!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Failed to save payout config: " + err.message);
    } finally {
      setPayoutConfigSaving(false);
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

  const handleSendQuickMessage = async (event) => {
    event.preventDefault();
    if (!quickMessageTarget?.email || !quickMessageText.trim()) return;
    setQuickMessageSaving(true);
    setError("");
    const targetLabel =
      quickMessageTarget.name || quickMessageTarget.email;
    try {
      await saveAdminMessage({
        title: "",
        text: quickMessageText.trim(),
        type: "info",
        target: quickMessageTarget.email,
        context: quickMessageTarget.context,
        requireAck: true,
        createdBy: user?.email || "",
      });
      setQuickMessageTarget(null);
      setQuickMessageText("");
      if (activeTab === "messages") {
        setAdminMessages(await fetchAllAdminMessages());
      }
      setSuccessMsg(`Message sent to ${targetLabel}.`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Failed to send message: " + err.message);
    } finally {
      setQuickMessageSaving(false);
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

  const handleOverrideComplete = async (enrollmentId) => {
    if (!window.confirm(`Override-complete this intern? This will force-certify regardless of task/payment status.`)) return;
    setActionLoading((p) => ({ ...p, [`override-${enrollmentId}`]: true }));
    try {
      await overrideCompleteEnrollment(enrollmentId, user?.email || "admin");
      await loadData();
      setSuccessMsg("Intern override-completed.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Override failed: " + err.message);
    } finally {
      setActionLoading((p) => ({ ...p, [`override-${enrollmentId}`]: false }));
    }
  };

  const handleUnverifyTask = async (enrollmentId, projectIdx) => {
    if (!window.confirm(`Unverify task #${+projectIdx + 1} for this intern?`)) return;
    const key = `unverify-task-${enrollmentId}-${projectIdx}`;
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      await unverifyProject(enrollmentId, projectIdx);
      await loadData();
      setSuccessMsg(`Task #${+projectIdx + 1} unverified.`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Unverify failed: " + err.message);
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
    }
  };

  const handleUnverifyPayment = async (enrollmentId) => {
    if (!window.confirm(`Unverify payment for this intern? The certificate will be locked until payment is completed again.`)) return;
    const reason = prompt("Reason for unverifying payment:");
    if (!reason) return;
    const key = `unverify-pay-${enrollmentId}`;
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      await unverifyPayment(enrollmentId, reason);
      await loadData();
      setSuccessMsg("Payment unverified.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Unverify payment failed: " + err.message);
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
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
      className="admin-panel-root"
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
          className="admin-tabs-row"
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

        {/* Filter Bar (relevant tabs only) */}
        {["interns", "works", "completed", "archived", "referrals", "visits", "referral users"].includes(activeTab) && (
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              alignItems: "flex-end",
              marginBottom: "1.5rem",
              padding: "0.75rem 1rem",
              border: "2px solid #000",
              background: "#fafafa",
            }}
          >
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>From Date</label>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>To Date</label>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }} />
            </div>
            {["interns", "works", "completed", "archived", "certificates"].includes(activeTab) && (
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Search</label>
                <input type="text" placeholder="Name, ID, or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "200px" }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Domain</label>
              <select value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
                <option value="">All</option>
                {Array.from(new Set((data.requests || []).map((r) => r.domain).filter(Boolean))).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            {(activeTab === "referrals" || activeTab === "referral users") && (
              <>
              <div>
                <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Min Interns</label>
                <input type="number" min="0" placeholder="0" value={filterInternCountMin} onChange={(e) => setFilterInternCountMin(e.target.value)} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "70px" }} />
              </div>
              {activeTab === "referral users" && (
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Payout Status</label>
                  <select value={payoutFilterStatus} onChange={(e) => setPayoutFilterStatus(e.target.value)} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="due">Due</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              )}
              {activeTab === "referral users" && (
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Paid From</label>
                  <input type="date" value={payoutDateFrom} onChange={(e) => setPayoutDateFrom(e.target.value)} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }} />
                </div>
              )}
              {activeTab === "referral users" && (
                <div>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Paid To</label>
                  <input type="date" value={payoutDateTo} onChange={(e) => setPayoutDateTo(e.target.value)} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }} />
                </div>
              )}
              </>
            )}
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Sort By</label>
              <select value={filterSortBy} onChange={(e) => setFilterSortBy(e.target.value)} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                {(activeTab === "referrals" || activeTab === "referral users") && (
                  <option value="interns-desc">Most Interns</option>
                )}
                {(activeTab === "referrals" || activeTab === "referral users") && (
                  <option value="interns-asc">Fewest Interns</option>
                )}
                {(activeTab === "referrals" || activeTab === "referral users") && (
                  <option value="achieved">Achieved First</option>
                )}
              </select>
            </div>
            <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterDomain(""); setFilterInternCountMin(""); setFilterSortBy("date-desc"); }} style={{ padding: "0.35rem 0.85rem", border: "2px solid #000", background: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700 }}>Clear All</button>
          </div>
        )}

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
            {(() => {
              let filtered = activeRequests;
              if (filterDomain) filtered = filtered.filter((r) => r.domain === filterDomain);
              if (searchTerm.trim()) {
                const st = searchTerm.trim().toLowerCase();
                filtered = filtered.filter((r) =>
                  (r.name || "").toLowerCase().includes(st) ||
                  (r.internId || "").toLowerCase().includes(st) ||
                  (r.email || "").toLowerCase().includes(st)
                );
              }
              if (filterDateFrom) filtered = filtered.filter((r) => !r.createdAt || new Date(r.createdAt) >= new Date(filterDateFrom));
              if (filterDateTo) filtered = filtered.filter((r) => !r.createdAt || new Date(r.createdAt) <= new Date(filterDateTo + "T23:59:59"));
              if (filterSortBy === "name-asc") filtered = [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
              else if (filterSortBy === "name-desc") filtered = [...filtered].sort((a, b) => (b.name || "").localeCompare(a.name || ""));
              else if (filterSortBy === "date-asc") filtered = [...filtered].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
              else filtered = [...filtered].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
              return filtered.length === 0 ? <EmptyBox msg="No intern registrations match filters." /> : (
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
                      <th style={th}>Payment</th>
                      <th style={th}>Certificate</th>
                      <th style={th}>Completed %</th>
                      <th style={th}>Submissions</th>
                      <th style={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => {
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
                          <td style={{ ...td, fontSize: "0.72rem" }}>
                            {(() => {
                              const isPaid = row.paymentTiming === "both" ? row.paymentStage === "fully_paid" : row.paymentStatus === "paid";
                              const isPartial = row.paymentStage === "start_paid";
                              const amt = row.paymentAmount;
                              return (
                                <>
                                  <span style={{ fontWeight: 700, color: isPaid ? "#34A853" : isPartial ? "#FBBC05" : "#EA4335" }}>
                                    {isPaid ? "Paid" : isPartial ? "Partial" : "Not Paid"}
                                  </span>
                                  {amt && <span style={{ marginLeft: "0.25rem" }}>₹{amt}</span>}
                                </>
                              );
                            })()}
                          </td>
                          <td style={{ ...td, fontSize: "0.72rem" }}>
                            <span style={{ fontWeight: 700, color: row.allowedCertificate === "yes" ? "#34A853" : "#999" }}>
                              {row.allowedCertificate === "yes" ? "UNLOCKED" : "Locked"}
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
                          <td style={{ ...td, fontSize: "0.72rem" }}>
                            {(() => {
                              const subs = getSubmissions(row);
                              const rowProjs = getProjectsForEnrollment(row);
                              const aiCount = rowProjs.filter((_, i) => subs[i]?.verifiedBy === "ai").length;
                              const manualCount = rowProjs.filter((_, i) => subs[i]?.verified === true && subs[i]?.verifiedBy !== "ai").length;
                              return (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
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
                                  {aiCount > 0 && <span style={{ color: "#9334E6", fontWeight: 600 }}>AI: {aiCount}</span>}
                                  {manualCount > 0 && <span style={{ color: "#4285F4", fontWeight: 600 }}>Manual: {manualCount}</span>}
                                  {!aiCount && !manualCount && subCount > 0 && <span style={{ color: "#999" }}>Pending verify</span>}
                                </div>
                              );
                            })()}
                          </td>
                          <td style={td}>
                            {row.email && (
                              <button
                                type="button"
                                onClick={() =>
                                  setQuickMessageTarget({
                                    email: row.email,
                                    name: row.name,
                                    context: "intern",
                                  })
                                }
                                style={{
                                  padding: "0.2rem 0.6rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  border: "2px solid #4285F4",
                                  background: "#4285F4",
                                  color: "#fff",
                                  cursor: "pointer",
                                  marginRight: "0.35rem",
                                }}
                              >
                                Message
                              </button>
                            )}
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
                            {!row.overrideCompleted && (
                              <button
                                type="button"
                                onClick={() => handleOverrideComplete(row.id)}
                                disabled={actionLoading[`override-${row.id}`]}
                                style={{
                                  padding: "0.2rem 0.6rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  border: "2px solid #9334E6",
                                  background: actionLoading[`override-${row.id}`] ? "#9334E6" : "#fff",
                                  color: actionLoading[`override-${row.id}`] ? "#fff" : "#9334E6",
                                  cursor: "pointer",
                                  marginRight: "0.35rem",
                                  marginBottom: "0.25rem",
                                }}
                              >
                                {actionLoading[`override-${row.id}`] ? "..." : "Override"}
                              </button>
                            )}
                            {row.paymentStatus === "paid" && (
                              <button
                                type="button"
                                onClick={() => handleUnverifyPayment(row.id)}
                                disabled={actionLoading[`unverify-pay-${row.id}`]}
                                style={{
                                  padding: "0.2rem 0.6rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                  border: "2px solid #EA4335",
                                  background: actionLoading[`unverify-pay-${row.id}`] ? "#EA4335" : "#fff",
                                  color: actionLoading[`unverify-pay-${row.id}`] ? "#fff" : "#EA4335",
                                  cursor: "pointer",
                                  marginRight: "0.35rem",
                                  marginBottom: "0.25rem",
                                }}
                              >
                                {actionLoading[`unverify-pay-${row.id}`] ? "..." : "Unverify Pay"}
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
            );})()}
          </div>
        )}

        {/* ── 2. INTERNSHIP WORKS TAB ── */}
        {activeTab === "works" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, textTransform: "uppercase", margin: 0 }}>
                Internship Works — Progress Overview
              </h3>
            </div>
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
                      !item.submission?.verified &&
                      !item.submission?.rejected,
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
                                      {(project?.type || "text") === "quiz" && (
                                        <span
                                          style={{
                                            marginLeft: "0.5rem",
                                            background: "#FBBC05",
                                            color: "#5a4000",
                                            fontSize: "0.6rem",
                                            fontWeight: 900,
                                            padding: "0.15rem 0.4rem",
                                            textTransform: "uppercase",
                                          }}
                                        >
                                          Quiz
                                        </span>
                                      )}
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
                              {(project?.type || "text") !== "quiz" && (
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
                              )}
                              {submission.quizScore !== undefined && (
                                <div
                                  style={{
                                    fontSize: "0.82rem",
                                    fontWeight: 700,
                                    color: submission.quizPassed
                                      ? "#34A853"
                                      : "#EA4335",
                                  }}
                                >
                                  Quiz Score: {submission.quizScore}% —{" "}
                                  {submission.quizPassed ? "PASSED" : "FAILED"}
                                </div>
                              )}
                              {submission.quizResults && Object.keys(submission.quizResults).length > 0 && (
                                <div style={{ fontSize: "0.75rem", marginTop: "0.3rem" }}>
                                  {(project?.quizQuestions || []).map((q, qi) => {
                                    const r = submission.quizResults[qi];
                                    if (r === undefined) return null;
                                    return (
                                      <div key={qi} style={{ marginBottom: "0.25rem", padding: "0.25rem 0.4rem", background: "#fafafa", border: "1px solid #eee" }}>
                                        <div style={{ fontWeight: 700 }}>Q{qi + 1}: {q.question}</div>
                                        <div style={{ color: "#555", marginTop: "0.1rem" }}>
                                          Submitted: <strong>{submission.quizAnswers?.[qi] ?? "(empty)"}</strong>
                                          {q.answer !== undefined && q.answer !== "" && (
                                            <span style={{ marginLeft: "0.5rem" }}>Correct: <strong style={{ color: "#34A853" }}>{q.answer}</strong></span>
                                          )}
                                          {r === true && <span style={{ color: "#34A853", marginLeft: "0.4rem" }}>✓</span>}
                                          {r === false && <span style={{ color: "#EA4335", marginLeft: "0.4rem" }}>✗</span>}
                                          {r === null && <span style={{ color: "#888", marginLeft: "0.4rem" }}>⏳ Pending</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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
                          {isCompleted && (
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
                                border: "2px solid #FBBC05",
                                background: "#FBBC05",
                                color: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              Mark Active
                            </button>
                          )}
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

        {/* ── 3. COMPLETED TAB ── */}
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
            {(() => {
              let filtered = completedRequests;
              if (filterDomain) filtered = filtered.filter((r) => r.domain === filterDomain);
              if (filterSortBy === "name-asc") filtered = [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
              else if (filterSortBy === "name-desc") filtered = [...filtered].sort((a, b) => (b.name || "").localeCompare(a.name || ""));
              else if (filterSortBy === "date-asc") filtered = [...filtered].sort((a, b) => (a.completedAt || a.createdAt || "").localeCompare(b.completedAt || b.createdAt || ""));
              else filtered = [...filtered].sort((a, b) => (b.completedAt || b.createdAt || "").localeCompare(a.completedAt || a.createdAt || ""));
              return filtered.length === 0 ? <EmptyBox msg="No completed internships match filters." /> : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {filtered.map((enrollment) => {
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
            );})()}
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
              let eligible = completedRequests;
              if (filterDomain) eligible = eligible.filter((r) => r.domain === filterDomain);
              if (filterSortBy === "name-asc") eligible = [...eligible].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
              else if (filterSortBy === "name-desc") eligible = [...eligible].sort((a, b) => (b.name || "").localeCompare(a.name || ""));
              else eligible = [...eligible].sort((a, b) => (b.completedAt || b.createdAt || "").localeCompare(a.completedAt || a.createdAt || ""));
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
            {(() => {
              let filtered = archivedRequests;
              if (filterDomain) filtered = filtered.filter((r) => r.domain === filterDomain);
              if (filterSortBy === "name-asc") filtered = [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
              else if (filterSortBy === "name-desc") filtered = [...filtered].sort((a, b) => (b.name || "").localeCompare(a.name || ""));
              else if (filterSortBy === "date-asc") filtered = [...filtered].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
              else filtered = [...filtered].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
              return filtered.length === 0 ? <EmptyBox msg="No archived internships match filters." /> : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {filtered.map((enrollment) => {
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
            );})()}
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
                      id: "DEV-CRAFT-" + Date.now().toString(36).toUpperCase(),
                      title: "New Domain",
                      duration: "4 Weeks",
                      description: "Brief description.",
                      features: ["Feature 1"],
                      projects: [
                        { title: "Project 1", description: "", links: [] },
                      ],
                      paymentQr: "",
                    },
                  ])
                }
              >
                + Add Domain
              </button>
            </div>
            {/* Categories Section */}
            <div style={{ border: "2px solid #000", padding: "1.25rem", boxShadow: "3px 3px 0 #000" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h4 style={{ fontWeight: 800, margin: 0 }}>Categories</h4>
                <button type="button" className="btn-sharp-outline" onClick={() => setDomainCategories([...domainCategories, { id: "cat_" + Date.now(), name: "", description: "", userTypes: [] }])} style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}>+ Add Category</button>
              </div>
              {domainCategories.length === 0 && <p style={{ fontSize: "0.85rem", color: "#888" }}>No categories defined. Add categories like "Internship", "Certificate", etc.</p>}
              {domainCategories.map((cat, idx) => (
                <div key={cat.id} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.5rem", padding: "0.75rem", background: "#f9f9f9", border: "1px solid #e0e0e0" }}>
                  <div><label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Category Name</label><input type="text" placeholder="e.g. Internship" value={cat.name} onChange={(e) => { const u = [...domainCategories]; u[idx] = { ...u[idx], name: e.target.value }; setDomainCategories(u); }} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "150px" }} /></div>
                  <div style={{ flex: 1, minWidth: "200px" }}><label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Description</label><input type="text" placeholder="Brief description" value={cat.description} onChange={(e) => { const u = [...domainCategories]; u[idx] = { ...u[idx], description: e.target.value }; setDomainCategories(u); }} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} /></div>
                  <div><label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Allowed User Types</label><select multiple value={cat.userTypes || []} onChange={(e) => { const u = [...domainCategories]; u[idx] = { ...u[idx], userTypes: Array.from(e.target.selectedOptions, (o) => o.value) }; setDomainCategories(u); }} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", background: "#fff", height: "60px" }}>
                    <option value="intern">Intern</option>
                    {userTypes.map((ut) => <option key={ut.id} value={ut.id}>{ut.name || ut.id}</option>)}
                  </select></div>
                  <div><label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Certificate Template</label><input type="text" placeholder="default" value={cat.certificateTemplate || ""} onChange={(e) => { const u = [...domainCategories]; u[idx] = { ...u[idx], certificateTemplate: e.target.value }; setDomainCategories(u); }} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "120px" }} /></div>
                  <button type="button" onClick={() => setDomainCategories(domainCategories.filter((_, i) => i !== idx))} style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem", fontWeight: 700, border: "2px solid #EA4335", background: "#fff", color: "#EA4335", cursor: "pointer" }}>Remove</button>
                </div>
              ))}
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
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.25rem" }}>
                          Category
                        </label>
                        <select value={path.category || ""} onChange={(e) => { const u = [...careerPaths]; u[idx].category = e.target.value; setCareerPaths(u); }} style={s}>
                          <option value="">None</option>
                          {domainCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name || cat.id}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.25rem" }}>
                          User Type
                        </label>
                        <select value={path.userType || "intern"} onChange={(e) => { const u = [...careerPaths]; u[idx].userType = e.target.value; setCareerPaths(u); }} style={s}>
                          <option value="intern">Intern</option>
                          {userTypes.map((ut) => <option key={ut.id} value={ut.id}>{ut.name || ut.id}</option>)}
                        </select>
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
                    <div style={{ marginBottom: "0.75rem" }}>
                      <label
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "block",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Payment QR Code URL
                      </label>
                      <input
                        className="input-sharp"
                        value={path.paymentQr || ""}
                        onChange={(e) => {
                          const u = [...careerPaths];
                          u[idx].paymentQr = e.target.value;
                          setCareerPaths(u);
                        }}
                        placeholder="https://example.com/qr.png"
                        style={s}
                      />
                      {path.paymentQr && (
                        <div style={{ marginTop: "0.5rem" }}>
                          <img
                            src={path.paymentQr}
                            alt="Payment QR Preview"
                            style={{
                              width: "100px",
                              border: "1px solid #ccc",
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.25rem" }}>
                          Payment Amount (₹) — Normal
                        </label>
                        <input type="number" min="0" value={path.paymentAmount || ""} onChange={(e) => { const u = [...careerPaths]; u[idx].paymentAmount = e.target.value ? +e.target.value : null; setCareerPaths(u); }}
                          placeholder="Use global default" style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "120px" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.25rem" }}>
                          Payment Amount (₹) — Referred
                        </label>
                        <input type="number" min="0" value={path.paymentAmountReferral || ""} onChange={(e) => { const u = [...careerPaths]; u[idx].paymentAmountReferral = e.target.value ? +e.target.value : null; setCareerPaths(u); }}
                          placeholder="Use global default" style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "120px" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.25rem" }}>
                          Payment Timing
                        </label>
                        <select value={path.paymentTiming || ""} onChange={(e) => { const u = [...careerPaths]; u[idx].paymentTiming = e.target.value; setCareerPaths(u); }}
                          style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
                          <option value="">Use global default</option>
                          <option value="start">Start (pay before projects)</option>
                          <option value="end">End (pay after all tasks verified)</option>
                          <option value="both">Both (pay at end for certificate)</option>
                        </select>
                      </div>
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
                              const normalizeLinks = (raw) => {
                                if (!raw) return [];
                                if (Array.isArray(raw)) {
                                  if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null && "items" in raw[0]) return raw;
                                  if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null && "url" in raw[0]) return [{ title: "", items: raw }];
                                  if (raw.length > 0 && typeof raw[0] === "object" && raw[0] !== null && "text" in raw[0]) return [{ title: "", items: raw.map((l) => ({ text: l.text, url: l.url })) }];
                                  return raw;
                              }
                              if (typeof raw === "string" && raw.trim()) {
                                return [{ title: "", items: raw.split(",").map((u) => ({ text: "Resource", url: u.trim() })).filter((l) => l.url) }];
                              }
                              return [];
                            };
                            const links = normalizeLinks(proj.links);
                            const updateProj = (field, val) => {
                              const u = JSON.parse(JSON.stringify(careerPaths));
                              const current = u[idx].projects[pIdx];
                              const obj =
                                typeof current === "object"
                                  ? { ...current }
                                  : {
                                      title: current,
                                      description: "",
                                      links: [],
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
                                    Reference Links
                                  </label>
                                  {links.map((group, gi) => (
                                    <div
                                      key={gi}
                                      style={{
                                        marginBottom: "0.75rem",
                                        padding: "0.5rem",
                                        border: "1px solid #ccc",
                                        background: "#fafafa",
                                      }}
                                    >
                                      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.35rem", alignItems: "center" }}>
                                        <input
                                          className="input-sharp"
                                          value={group.title || ""}
                                          onChange={(e) => {
                                            const updated = JSON.parse(JSON.stringify(links));
                                            updated[gi].title = e.target.value;
                                            updateProj("links", updated);
                                          }}
                                          placeholder="Section title (e.g. Documentation)"
                                          style={{ ...s, flex: 1 }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            updateProj("links", links.filter((_, i) => i !== gi));
                                          }}
                                          style={{
                                            border: "2px solid #EA4335",
                                            color: "#EA4335",
                                            background: "#fff",
                                            cursor: "pointer",
                                            padding: "0.2rem 0.5rem",
                                            fontSize: "0.7rem",
                                            fontWeight: 700,
                                            flexShrink: 0,
                                          }}
                                        >
                                          Remove Group
                                        </button>
                                      </div>
                                      {(group.items || []).map((item, ii) => (
                                        <div
                                          key={ii}
                                          style={{
                                            display: "flex",
                                            gap: "0.4rem",
                                            marginBottom: "0.3rem",
                                            marginLeft: "1rem",
                                            alignItems: "center",
                                          }}
                                        >
                                          <input
                                            className="input-sharp"
                                            value={item.text || ""}
                                            onChange={(e) => {
                                              const updated = JSON.parse(JSON.stringify(links));
                                              updated[gi].items[ii].text = e.target.value;
                                              updateProj("links", updated);
                                            }}
                                            placeholder="Link label"
                                            style={{ ...s, width: "120px", flexShrink: 0 }}
                                          />
                                          <input
                                            className="input-sharp"
                                            value={item.url || ""}
                                            onChange={(e) => {
                                              const updated = JSON.parse(JSON.stringify(links));
                                              updated[gi].items[ii].url = e.target.value;
                                              updateProj("links", updated);
                                            }}
                                            placeholder="https://example.com"
                                            style={{ ...s, flex: 1 }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = JSON.parse(JSON.stringify(links));
                                              updated[gi].items = updated[gi].items.filter((_, i) => i !== ii);
                                              updateProj("links", updated);
                                            }}
                                            style={{
                                              border: "2px solid #EA4335",
                                              color: "#EA4335",
                                              background: "#fff",
                                              cursor: "pointer",
                                              padding: "0.15rem 0.4rem",
                                              fontSize: "0.65rem",
                                              fontWeight: 700,
                                              flexShrink: 0,
                                            }}
                                          >
                                            X
                                          </button>
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = JSON.parse(JSON.stringify(links));
                                          updated[gi].items = [...(updated[gi].items || []), { text: "", url: "" }];
                                          updateProj("links", updated);
                                        }}
                                        style={{
                                          border: "none",
                                          color: "#000",
                                          background: "none",
                                          cursor: "pointer",
                                          padding: "0.15rem 0.5rem",
                                          fontSize: "0.75rem",
                                          fontWeight: 700,
                                          textDecoration: "underline",
                                          marginLeft: "1rem",
                                        }}
                                      >
                                        + Add Link to "{group.title || `Group ${gi + 1}`}"
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateProj("links", [...links, { title: "", items: [{ text: "", url: "" }] }]);
                                    }}
                                    style={{
                                      border: "2px solid #000",
                                      color: "#000",
                                      background: "#fff",
                                      cursor: "pointer",
                                      padding: "0.2rem 0.7rem",
                                      fontSize: "0.75rem",
                                      fontWeight: 700,
                                      marginTop: "0.25rem",
                                    }}
                                  >
                                    + Add Link Group
                                  </button>
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
                                    Task Type
                                  </label>
                                  <select
                                    className="input-sharp"
                                    value={proj.type || "text"}
                                    onChange={(e) =>
                                      updateProj("type", e.target.value)
                                    }
                                    style={s}
                                  >
                                    <option value="text">Text Submission</option>
                                    <option value="quiz">Quiz</option>
                                  </select>
                                </div>
                                {(proj.type || "text") === "quiz" && (
                                  <div
                                    style={{
                                      marginTop: "0.5rem",
                                      padding: "0.75rem",
                                      border: "2px solid #FBBC05",
                                      background: "#fffdf0",
                                    }}
                                  >
                                    <div style={{ marginBottom: "0.5rem" }}>
                                      <label
                                        style={{
                                          fontSize: "0.7rem",
                                          fontWeight: 700,
                                          display: "block",
                                          marginBottom: "0.2rem",
                                        }}
                                      >
                                        Passing Grade (%){" "}
                                        <span style={{ fontWeight: 400, color: "#888" }}>
                                          (score must be ≥ this to pass)
                                        </span>
                                      </label>
                                      <input
                                        className="input-sharp"
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={proj.passingGrade ?? 100}
                                        onChange={(e) =>
                                          updateProj("passingGrade", Number(e.target.value))
                                        }
                                        style={{ ...s, width: "100px" }}
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
                                        Questions ({(proj.quizQuestions || []).length})
                                      </label>
                                      {(proj.quizQuestions || []).length === 0 ? (
                                        <p style={{ fontSize: "0.8rem", color: "#888", fontStyle: "italic" }}>
                                          No questions added yet.
                                        </p>
                                      ) : (
                                        <ul style={{ fontSize: "0.8rem", margin: "0.25rem 0", paddingLeft: "1.25rem" }}>
                                          {(proj.quizQuestions || []).slice(0, 3).map((q, qi) => (
                                            <li key={qi}>
                                              {q.question || `Question ${qi + 1}`}
                                              <span style={{ color: "#888" }}>
                                                {" "}({q.type || "text"})
                                              </span>
                                            </li>
                                          ))}
                                          {(proj.quizQuestions || []).length > 3 && (
                                            <li style={{ color: "#888" }}>
                                              +{proj.quizQuestions.length - 3} more
                                            </li>
                                          )}
                                        </ul>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setQuizModalDomainIdx(idx);
                                          setQuizModalProjIdx(pIdx);
                                          setQuizModalQuestions(
                                            JSON.parse(JSON.stringify(proj.quizQuestions || [])),
                                          );
                                        }}
                                        style={{
                                          border: "2px solid #000",
                                          color: "#000",
                                          background: "#fff",
                                          cursor: "pointer",
                                          padding: "0.3rem 0.8rem",
                                          fontSize: "0.75rem",
                                          fontWeight: 700,
                                          marginTop: "0.25rem",
                                        }}
                                      >
                                        Manage Questions
                                      </button>
                                    </div>
                                  </div>
                                )}
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
                                    {autoNoticeSaving[`${idx}_${pIdx}`]
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
                              { title: "New Task", description: "", links: [], type: "text", quizQuestions: [], passingGrade: 100 },
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
                      <div style={{ marginTop: "1.5rem", borderTop: "2px solid #ddd", paddingTop: "1rem" }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Action Buttons
                        </label>
                        {(path.buttons || []).map((btn, bi) => (
                          <div key={bi} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                            <input value={btn.label || ""} onChange={(e) => { const u = [...careerPaths]; u[idx].buttons = [...(u[idx].buttons || [])]; u[idx].buttons[bi] = { ...u[idx].buttons[bi], label: e.target.value }; setCareerPaths(u); }}
                              placeholder="Button label" style={{ border: "1px solid #000", padding: "0.25rem 0.5rem", fontSize: "0.8rem", fontFamily: "inherit", outline: "none", width: "160px" }} />
                            <select value={btn.templateName || ""} onChange={(e) => { const u = [...careerPaths]; u[idx].buttons = [...(u[idx].buttons || [])]; u[idx].buttons[bi] = { ...u[idx].buttons[bi], templateName: e.target.value }; setCareerPaths(u); }}
                              style={{ border: "1px solid #000", padding: "0.25rem 0.5rem", fontSize: "0.8rem", fontFamily: "inherit", outline: "none", background: "#fff" }}>
                              <option value="">-- Select Template --</option>
                              {(templates.templateOrder || []).map((tKey) => <option key={tKey} value={tKey}>{tKey}</option>)}
                            </select>
                            <select value={btn.showWhen || "after"} onChange={(e) => { const u = [...careerPaths]; u[idx].buttons = [...(u[idx].buttons || [])]; u[idx].buttons[bi] = { ...u[idx].buttons[bi], showWhen: e.target.value }; setCareerPaths(u); }}
                              style={{ border: "1px solid #000", padding: "0.25rem 0.5rem", fontSize: "0.8rem", fontFamily: "inherit", outline: "none", background: "#fff" }}>
                              <option value="before">Before Tasks</option>
                              <option value="after">After Tasks</option>
                            </select>
                            <button type="button" onClick={() => { const u = [...careerPaths]; u[idx].buttons = (u[idx].buttons || []).filter((_, i) => i !== bi); setCareerPaths(u); }}
                              style={{ border: "1px solid #EA4335", color: "#EA4335", background: "none", cursor: "pointer", padding: "0.1rem 0.4rem", fontSize: "0.8rem" }}>Remove</button>
                          </div>
                        ))}
                        <button type="button" className="btn-sharp-outline" onClick={() => { const u = [...careerPaths]; u[idx].buttons = [...(u[idx].buttons || []), { label: "Download", templateName: "", showWhen: "after" }]; setCareerPaths(u); }}
                          style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem", marginTop: "0.25rem" }}>+ Add Button</button>
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
        {/* ── OVERRIDE VALIDATE TAB ── */}
        {activeTab === "override-validate" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, textTransform: "uppercase", margin: 0 }}>Override Validate</h3>
            <p style={{ color: "#666", fontSize: "0.85rem" }}>All interns listed below. Use search to filter. Override-complete bypasses task/payment checks.</p>
            <div>
              <input type="text" placeholder="Search by name, intern ID, email, or domain..." value={overrideSearch} onChange={(e) => setOverrideSearch(e.target.value)} style={{ border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", width: "400px", maxWidth: "100%", boxSizing: "border-box" }} />
            </div>
            {dataLoading ? <div style={{ color: "#888" }}>Loading interns…</div> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                  <thead>
                    <tr style={{ background: "#000", color: "#fff", borderBottom: "2px solid #000" }}>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 700 }}>Intern ID</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 700 }}>Name</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 700 }}>Email</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 700 }}>Domain</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700 }}>Tasks</th>
                          <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700 }}>Payment</th>
                          <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700 }}>Certificate</th>
                          <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700 }}>Status</th>
                          <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests.filter((r) => {
                      if (!overrideSearch.trim()) return true;
                      const q = overrideSearch.trim().toLowerCase();
                      return (r.name || "").toLowerCase().includes(q) || (r.internId || r.id || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q) || (r.domain || "").toLowerCase().includes(q);
                    }).map((row, i) => {
                      const projs = getProjectsForEnrollment(row);
                      const subs = getSubmissions(row);
                      const verifiedCount = projs.filter((_, idx) => subs[idx]?.verified).length;
                      const isPaid = row.paymentTiming === "both" ? row.paymentStage === "fully_paid" : row.paymentStatus === "paid";
                      const canComplete = verifiedCount === projs.length && projs.length > 0 && isPaid;
                      return (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e0e0e0", background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
                          <td style={{ padding: "0.5rem 0.75rem" }}><code style={{ fontSize: "0.75rem", fontWeight: 700 }}>{row.internId || row.id.slice(0, 8)}</code></td>
                          <td style={{ padding: "0.5rem 0.75rem", fontWeight: 700 }}>{row.name}</td>
                          <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.78rem" }}>{row.email}</td>
                          <td style={{ padding: "0.5rem 0.75rem" }}>{row.domain}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                            <span style={{ color: verifiedCount === projs.length && projs.length > 0 ? "#34A853" : "#EA4335", fontWeight: 700 }}>
                              {verifiedCount}/{projs.length}
                            </span>
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                            <span style={{ color: isPaid ? "#34A853" : "#EA4335", fontWeight: 700 }}>
                              {isPaid ? "Paid" : (row.paymentStage === "start_paid" ? "Partial" : "Not Paid")}
                            </span>
                            {row.paymentAmount ? <span style={{ marginLeft: "0.2rem", fontSize: "0.72rem" }}>₹{row.paymentAmount}</span> : null}
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.72rem", color: row.allowedCertificate === "yes" ? "#34A853" : "#999" }}>
                              {row.allowedCertificate === "yes" ? "UNLOCKED" : "Locked"}
                            </span>
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                            <span style={{ display: "inline-block", padding: "0.15rem 0.5rem", fontSize: "0.72rem", fontWeight: 800, background: row.status === "Completed" ? "#34A853" : "#FBBC05", color: "#fff" }}>{row.status}</span>
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                            {canComplete ? (
                              <span style={{ color: "#34A853", fontWeight: 700, fontSize: "0.78rem" }}>✓ Ready</span>
                            ) : (
                              <button onClick={() => {
                                if (!window.confirm(`Override-complete "${row.name}" (${row.internId || row.id.slice(0, 8)})? This will force-complete regardless of task/payment status.`)) return;
                                (async () => {
                                  try { await overrideCompleteEnrollment(row.id, user?.email || "admin"); await loadData(); setSuccessMsg(`${row.name} override-completed!`); setTimeout(() => setSuccessMsg(""), 3000); } catch (err) { setError(err.message); }
                                })();
                              }} style={{ padding: "0.3rem 0.85rem", fontSize: "0.75rem", fontWeight: 800, border: "2px solid #9334E6", background: "#9334E6", color: "#fff", cursor: "pointer", borderRadius: 0 }}>
                                Override Complete
                              </button>
                            )}
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

        {/* ── USER TYPES TAB ── */}
        {activeTab === "user-types" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, textTransform: "uppercase", margin: 0 }}>User Types</h3>
              <button type="button" className="btn-sharp-outline" onClick={() => setUserTypes([...userTypes, { id: "type_" + Date.now(), name: "", type: "receive", description: "" }])} style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}>+ Add User Type</button>
            </div>
            {userTypesLoading ? <div style={{ color: "#888" }}>Loading…</div> : (
              <>
                {userTypes.length === 0 && <p style={{ color: "#888" }}>No user types configured. Add one to define new participant categories like referral partners, mentors, etc.</p>}
                {userTypes.map((ut, idx) => (
                  <div key={ut.id} style={{ border: "2px solid #000", padding: "1.25rem", boxShadow: "3px 3px 0 #000" }}>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div style={{ flex: 1, minWidth: "150px" }}>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Name</label>
                        <input type="text" placeholder="e.g. Mentor" value={ut.name} onChange={(e) => { const u = [...userTypes]; u[idx] = { ...u[idx], name: e.target.value }; setUserTypes(u); }} style={{ border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Payout Direction</label>
                        <select value={ut.type} onChange={(e) => { const u = [...userTypes]; u[idx] = { ...u[idx], type: e.target.value }; setUserTypes(u); }} style={{ border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
                          <option value="receive">Receives Payout</option>
                          <option value="send">Sends Payout</option>
                        </select>
                      </div>
                      <div style={{ flex: 2, minWidth: "200px" }}>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Description</label>
                        <input type="text" placeholder="Brief description" value={ut.description} onChange={(e) => { const u = [...userTypes]; u[idx] = { ...u[idx], description: e.target.value }; setUserTypes(u); }} style={{ border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
                      </div>
                      <button type="button" onClick={() => setUserTypes(userTypes.filter((_, i) => i !== idx))} style={{ padding: "0.45rem 0.75rem", fontSize: "0.75rem", fontWeight: 700, border: "2px solid #EA4335", background: "#fff", color: "#EA4335", cursor: "pointer" }}>Remove</button>
                    </div>
                  </div>
                ))}
                {userTypes.length > 0 && (
                  <button onClick={async () => { setUserTypesSaving(true); try { await saveUserTypes(userTypes); setSuccessMsg("User types saved!"); setTimeout(() => setSuccessMsg(""), 3000); } catch (err) { setError(err.message); } finally { setUserTypesSaving(false); } }} className="btn-sharp" disabled={userTypesSaving} style={{ alignSelf: "flex-start", padding: "0.7rem 2rem" }}>
                    {userTypesSaving ? "Saving…" : "Save User Types"}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── PAYMENT SETTINGS TAB ── */}
        {activeTab === "payment-settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, textTransform: "uppercase", margin: 0 }}>
                Payment Settings
              </h3>
            </div>

            {/* Payment Stats */}
            <div style={{ border: "2px solid #000", padding: "1.25rem", boxShadow: "3px 3px 0 #000", background: "#f0fdf4" }}>
              <h4 style={{ fontWeight: 800, marginBottom: "0.75rem" }}>Payment Summary</h4>
              {paymentStats ? (
                <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                  <div><strong>Total Collected:</strong> ₹{paymentStats.totalCollected}</div>
                  <div><strong>To Distribute (Referrals):</strong> <span style={{ color: "#EA4335" }}>₹{paymentStats.totalDistribute}</span></div>
                  <div><strong>Net Total:</strong> <span style={{ color: "#34A853", fontWeight: 800 }}>₹{paymentStats.netTotal}</span></div>
                  <div><strong>Paid Interns:</strong> {paymentStats.paidEnrollments}</div>
                </div>
              ) : <div style={{ color: "#888" }}>Loading stats…</div>}
              <button onClick={loadPaymentStats} style={{ marginTop: "0.5rem", padding: "0.3rem 0.75rem", fontSize: "0.75rem", border: "2px solid #000", background: "#fff", cursor: "pointer", fontWeight: 700 }}>Refresh Stats</button>
            </div>

            {!paymentSettings ? (
              <div style={{ color: "#888" }}>Loading payment data…</div>
            ) : (
              <>
                {/* Global default */}
                <div style={{ border: "2px solid #000", padding: "1.25rem", boxShadow: "3px 3px 0 #000" }}>
                  <h4 style={{ fontWeight: 800, marginBottom: "0.75rem" }}>Global Default</h4>
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Default Amount (₹) — Normal Intern</label>
                      <input type="number" min="0" value={paymentSettings.defaultAmount ?? 200} onChange={(e) => setPaymentSettings((p) => ({ ...p, defaultAmount: +e.target.value }))} style={{ border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", width: "120px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Default Amount (₹) — Referred Intern</label>
                      <input type="number" min="0" value={paymentSettings.defaultAmountReferral ?? 170} onChange={(e) => setPaymentSettings((p) => ({ ...p, defaultAmountReferral: +e.target.value }))} style={{ border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", width: "120px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Default Timing</label>
                      <select value={paymentSettings.defaultTiming ?? "end"} onChange={(e) => setPaymentSettings((p) => ({ ...p, defaultTiming: e.target.value }))} style={{ border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
                        <option value="start">Start (pay before projects)</option>
                        <option value="end">End (pay after all tasks verified)</option>
                        <option value="both">Both (pay at end for certificate)</option>
                      </select>
                    </div>
                  </div>
                </div>
                {/* Per-domain overrides */}
                <div style={{ border: "2px solid #000", padding: "1.25rem", boxShadow: "3px 3px 0 #000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h4 style={{ fontWeight: 800, margin: 0 }}>Per-Domain Overrides</h4>
                    <button type="button" className="btn-sharp-outline" onClick={() => setPaymentSettings((p) => ({ ...p, domains: [...(p.domains || []), { domain: "", amount: null, amountReferral: null, timing: "" }] }))} style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem" }}>
                      + Add Domain
                    </button>
                  </div>
                  {(paymentSettings.domains || []).length === 0 && <p style={{ fontSize: "0.85rem", color: "#888" }}>No domain overrides configured. All domains use the global default.</p>}
                  {(paymentSettings.domains || []).map((d, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginTop: "0.5rem", padding: "0.75rem", background: "#f9f9f9", border: "1px solid #e0e0e0" }}>
                      <div><label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Domain</label><input type="text" placeholder="e.g. Web Development" value={d.domain} onChange={(e) => { const updated = [...(paymentSettings.domains || [])]; updated[idx] = { ...updated[idx], domain: e.target.value }; setPaymentSettings((p) => ({ ...p, domains: updated })); }} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "150px" }} /></div>
                      <div><label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Amount (₹) Normal</label><input type="number" min="0" placeholder="Default" value={d.amount ?? ""} onChange={(e) => { const updated = [...(paymentSettings.domains || [])]; updated[idx] = { ...updated[idx], amount: e.target.value ? +e.target.value : null }; setPaymentSettings((p) => ({ ...p, domains: updated })); }} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "80px" }} /></div>
                      <div><label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Amount (₹) Referred</label><input type="number" min="0" placeholder="Default" value={d.amountReferral ?? ""} onChange={(e) => { const updated = [...(paymentSettings.domains || [])]; updated[idx] = { ...updated[idx], amountReferral: e.target.value ? +e.target.value : null }; setPaymentSettings((p) => ({ ...p, domains: updated })); }} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", width: "80px" }} /></div>
                      <div><label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Timing</label><select value={d.timing} onChange={(e) => { const updated = [...(paymentSettings.domains || [])]; updated[idx] = { ...updated[idx], timing: e.target.value }; setPaymentSettings((p) => ({ ...p, domains: updated })); }} style={{ border: "2px solid #000", padding: "0.35rem 0.5rem", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
                        <option value="">Use default</option><option value="start">Start</option><option value="end">End</option><option value="both">Both</option>
                      </select></div>
                      <button type="button" onClick={() => { const updated = (paymentSettings.domains || []).filter((_, i) => i !== idx); setPaymentSettings((p) => ({ ...p, domains: updated })); }} style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem", fontWeight: 700, border: "2px solid #EA4335", background: "#fff", color: "#EA4335", cursor: "pointer" }}>Remove</button>
                    </div>
                  ))}
                </div>
                {/* Payout Config */}
                <div style={{ border: "2px solid #000", padding: "1.25rem", boxShadow: "3px 3px 0 #000" }}>
                  <h4 style={{ fontWeight: 800, marginBottom: "0.75rem" }}>Referral Payout Config</h4>
                  <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Payout Every (Days)</label>
                      <input type="number" min="1" value={payoutConfig?.payoutDays ?? 30} onChange={(e) => setPayoutConfig((p) => ({ ...p, payoutDays: +e.target.value }))} style={{ border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", width: "100px" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.25rem" }}>Default Payout Per Intern (₹)</label>
                      <input type="number" min="0" value={payoutConfig?.defaultPayoutPerIntern ?? 30} onChange={(e) => setPayoutConfig((p) => ({ ...p, defaultPayoutPerIntern: +e.target.value }))} style={{ border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", width: "100px" }} />
                    </div>
                    <button onClick={handleSavePayoutConfig} className="btn-sharp" disabled={payoutConfigSaving} style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}>
                      {payoutConfigSaving ? "Saving…" : "Save Payout Config"}
                    </button>
                  </div>
                </div>
                <button onClick={handleSavePaymentSettings} className="btn-sharp" disabled={paymentSettingsSaving} style={{ alignSelf: "flex-start", padding: "0.7rem 2rem" }}>
                  {paymentSettingsSaving ? "Saving…" : "Save Payment Settings"}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, textTransform: "uppercase", margin: "0 0 0.5rem" }}>
                Credential HTML Templates
              </h3>
              <p style={{ color: "#666", fontSize: "0.82rem", margin: 0 }}>
                Edit the HTML below. All enrollment fields are available as variables, e.g.{" "}
                <code>{"{{name}}"}</code> <code>{"{{email}}"}</code> <code>{"{{phone}}"}</code> <code>{"{{college}}"}</code>{" "}
                <code>{"{{city}}"}</code> <code>{"{{country}}"}</code> <code>{"{{domain}}"}</code> <code>{"{{internId}}"}</code>{" "}
                <code>{"{{date}}"}</code>. When an intern clicks a button, the HTML is auto-filled and a print dialog opens.
              </p>
            </div>
            {contentLoading ? (
              <div style={{ color: "#888" }}>Loading templates…</div>
            ) : (
              <>
                <button type="button" className="btn-sharp-outline" onClick={() => {
                  const name = prompt("New template name:");
                  if (!name) return;
                  const key = name.trim();
                  if (templates.templates?.[key]) { alert("Template name already exists."); return; }
                  setTemplates({ ...templates, templates: { ...(templates.templates || {}), [key]: "" }, templateOrder: [...(templates.templateOrder || []), key] });
                }} style={{ alignSelf: "flex-start", fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}>
                  + Add Template
                </button>
                {(templates.templateOrder || []).map((key) => (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", border: "1px solid #ddd", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <input value={key} onChange={(e) => {
                        const newKey = e.target.value.trim();
                        if (!newKey || (newKey !== key && templates.templates?.[newKey])) return;
                        const tmpl = { ...(templates.templates || {}) };
                        tmpl[newKey] = tmpl[key] || "";
                        delete tmpl[key];
                        const order = (templates.templateOrder || []).map((k) => k === key ? newKey : k);
                        setTemplates({ ...templates, templates: tmpl, templateOrder: order });
                      }} style={{ border: "1px solid #000", padding: "0.25rem 0.5rem", fontSize: "0.85rem", fontWeight: 700, fontFamily: "inherit", outline: "none", width: "200px" }} />
                      <button type="button" onClick={() => {
                        if (!window.confirm(`Delete template "${key}"?`)) return;
                        const tmpl = { ...(templates.templates || {}) };
                        delete tmpl[key];
                        const order = (templates.templateOrder || []).filter((k) => k !== key);
                        setTemplates({ ...templates, templates: tmpl, templateOrder: order });
                      }} style={{ border: "1px solid #EA4335", color: "#EA4335", background: "none", cursor: "pointer", padding: "0.1rem 0.4rem", fontSize: "0.8rem" }}>
                        Delete
                      </button>
                    </div>
                    <textarea rows={14} value={(templates.templates || {})[key] || ""} onChange={(e) => setTemplates({ ...templates, templates: { ...(templates.templates || {}), [key]: e.target.value } })}
                      style={{ fontFamily: "monospace", fontSize: "0.75rem", border: "2px solid #000", padding: "0.5rem", resize: "vertical", width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                ))}
                <button onClick={handleSaveTemplates} className="btn-sharp" disabled={contentSaving} style={{ alignSelf: "flex-start", padding: "0.7rem 2rem" }}>
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

            {/* Filters */}
            <div
              style={{
                display: "flex",
                gap: "1rem",
                flexWrap: "wrap",
                alignItems: "flex-end",
                marginBottom: "1.5rem",
                padding: "1rem",
                border: "2px solid #000",
                background: "#fafafa",
              }}
            >
            </div>

            {(!data.referrals || data.referrals.length === 0) ? (
              <EmptyBox msg="No referral users yet." />
            ) : (
              (() => {
                // Sort by most assigned internships (most referred) on top
                const sorted = [...data.referrals].sort(
                  (a, b) =>
                    (Number(b.assignedInternships) || 0) -
                    (Number(a.assignedInternships) || 0),
                );

                const active = sorted.filter(
                  (r) => !doneReferralCodes.has(r.code),
                );
                const done = sorted.filter((r) =>
                  doneReferralCodes.has(r.code),
                );

                const renderReferralCard = (referral, isDone) => (
                  <div
                    key={referral.code || referral.id}
                    style={{
                      border: isDone ? "2px solid #aaa" : "2px solid #000",
                      padding: "1.25rem",
                      background: isDone ? "#f5f5f5" : "#fff",
                      boxShadow: isDone ? "none" : "3px 3px 0 #000",
                      opacity: isDone ? 0.7 : 1,
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
                          {referral.createdAt && (
                            <div>
                              <strong>Added:</strong>{" "}
                              {new Date(
                                referral.createdAt,
                              ).toLocaleDateString()}
                            </div>
                          )}
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
                        <div
                          style={{
                            display: "flex",
                            gap: "0.4rem",
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          {!isDone ? (
                            <>
                              {referral.email && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuickMessageTarget({
                                      email: referral.email,
                                      name: referral.name,
                                      context: "referral",
                                    })
                                  }
                                  style={{
                                    padding: "0.25rem 0.75rem",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    border: "2px solid #4285F4",
                                    background: "#4285F4",
                                    color: "#fff",
                                    cursor: "pointer",
                                  }}
                                >
                                  Message
                                </button>
                              )}
                            <button
                              type="button"
                              onClick={() =>
                                setDoneReferralCodes(
                                  (prev) => new Set([...prev, referral.code]),
                                )
                              }
                              style={{
                                padding: "0.25rem 0.75rem",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                border: "2px solid #34A853",
                                background: "#34A853",
                                color: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              ✓ Done
                            </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setDoneReferralCodes((prev) => {
                                  const s = new Set(prev);
                                  s.delete(referral.code);
                                  return s;
                                })
                              }
                              style={{
                                padding: "0.25rem 0.75rem",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                border: "2px solid #888",
                                background: "#fff",
                                color: "#888",
                                cursor: "pointer",
                              }}
                            >
                              Undo
                            </button>
                          )}
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
                        label="Assigned"
                        value={referral.assignedInternships || 0}
                        color="#4285F4"
                      />
                      <ReferralStat
                        label="Completed"
                        value={referral.completedInterns || 0}
                        color="#34A853"
                      />
                      <ReferralStat
                        label="Completed & Paid"
                        value={referral.completedAndPaidInterns || 0}
                        color="#34A853"
                      />
                      <ReferralStat
                        label="Not Paid"
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
                        title="Assigned IDs"
                        ids={referral.assignedInternIds}
                      />
                      <InternIdList
                        title="Completed IDs"
                        ids={referral.completedInternIds}
                      />
                      <InternIdList
                        title="Paid IDs"
                        ids={referral.completedAndPaidInternIds}
                      />
                      <InternIdList
                        title="Not Paid IDs"
                        ids={referral.completedNotPaidInternIds}
                      />
                    </div>
                  </div>
                );

                return (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {active.length === 0 && done.length === 0 && (
                      <EmptyBox msg="No referrals match the selected date range." />
                    )}
                    {active.map((r) => renderReferralCard(r, false))}

                    {done.length > 0 && (
                      <>
                        <div
                          style={{
                            borderTop: "2px dashed #ccc",
                            paddingTop: "1.5rem",
                            marginTop: "0.5rem",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 800,
                              color: "#888",
                              textTransform: "uppercase",
                              marginBottom: "1rem",
                              letterSpacing: "0.05em",
                            }}
                          >
                            ✓ Done ({done.length})
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.75rem",
                            }}
                          >
                            {done.map((r) => renderReferralCard(r, true))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()
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
              All Visits
            </h3>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
              <div style={{ border: "2px solid #000", padding: "0.75rem 1.25rem", background: "#fff", textAlign: "center", minWidth: "150px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 900 }}>{(data.siteVisits?.length || 0) + data.visits.length}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Total Visits</div>
              </div>
              <div style={{ border: "2px solid #000", padding: "0.75rem 1.25rem", background: "#fff", textAlign: "center", minWidth: "150px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 900 }}>{data.siteVisits?.length || 0}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Site Visits</div>
              </div>
              <div style={{ border: "2px solid #000", padding: "0.75rem 1.25rem", background: "#fff", textAlign: "center", minWidth: "150px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 900 }}>{data.visits.length}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Referral Visits</div>
              </div>
              <div style={{ border: "2px solid #000", padding: "0.75rem 1.25rem", background: "#fff", textAlign: "center", minWidth: "150px" }}>
                <div style={{ fontSize: "2rem", fontWeight: 900 }}>{data.siteVisits?.filter((v) => v.email && v.email !== "-").length || 0}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", color: "#888" }}>Logged In</div>
              </div>
            </div>
            <div style={{ marginBottom: "2rem" }}>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 900, textTransform: "uppercase", marginBottom: "0.75rem", color: "#555" }}>
                General Site Visits ({data.siteVisits?.length || 0})
              </h4>
              <SimpleTable
                empty="No general site visits yet."
                columns={[
                  "visitedAt",
                  "name",
                  "email",
                  "referrer",
                  "url",
                  "userAgent",
                  "language",
                  "screen",
                  "viewport",
                ]}
                rows={data.siteVisits || []}
              />
            </div>
            <div>
              <h4 style={{ fontSize: "0.95rem", fontWeight: 900, textTransform: "uppercase", marginBottom: "0.75rem", color: "#555" }}>
                Referral Link Visits ({data.visits.length})
              </h4>
              <SimpleTable
                empty="No referral visits yet."
                columns={[
                  "referralCode",
                  "matched",
                  "browser",
                  "device",
                  "os",
                  "visitedFrom",
                  "link",
                  "ip",
                  "country",
                  "city",
                  "isVpn",
                  "timezone",
                  "visitedAt",
                ]}
                rows={data.visits || []}
              />
            </div>
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
            {(() => {
              const payoutDays = 30;
              const dueReferrals = referralUsersData.filter((r) => {
                if ((r.payoutStatus || "pending") === "done") return false;
                const lastPayout = r.payoutAt ? new Date(r.payoutAt) : r.createdAt ? new Date(r.createdAt) : null;
                if (!lastPayout) return r.internCount > 0;
                return (Date.now() - lastPayout.getTime()) / (1000 * 60 * 60 * 24) >= payoutDays;
              });
              if (dueReferrals.length === 0) return null;
              return (
                <div style={{ padding: "0.75rem 1rem", background: "#FFF3CD", border: "2px solid #FFC107", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                  <span style={{ fontWeight: 700 }}>⚠️ {dueReferrals.length} referral{dueReferrals.length > 1 ? "s" : ""} with pending payout{dueReferrals.length > 1 ? "s" : ""} due</span>
                  <button type="button" onClick={() => setPayoutFilterStatus("due")} style={{ padding: "0.35rem 0.85rem", border: "2px solid #000", background: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}>
                    Show Due Only
                  </button>
                </div>
              );
            })()}
            {referralDataLoading ? (
              <div
                style={{ textAlign: "center", padding: "2rem", color: "#888" }}
              >
                Loading referral users…
              </div>
            ) : referralUsersData.length === 0 ? (
              <EmptyBox msg="No referral users found." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {referralUsersData
                  .filter((r) => {
                    const minCount = parseInt(filterInternCountMin, 10);
                    return isNaN(minCount) || r.internCount >= minCount;
                  })
                  .filter((r) => {
                    if (!payoutFilterStatus) return true;
                    const status = r.payoutStatus || "pending";
                    if (payoutFilterStatus === "due") {
                      if (status === "done") return false;
                      const payoutDays = r.payoutConfig?.payoutDays || 30;
                      const lastPayout = r.payoutAt ? new Date(r.payoutAt) : r.createdAt ? new Date(r.createdAt) : null;
                      if (!lastPayout) return true;
                      const diffDays = (Date.now() - lastPayout.getTime()) / (1000 * 60 * 60 * 24);
                      return diffDays >= payoutDays;
                    }
                    return status === payoutFilterStatus;
                  })
                  .filter((r) => {
                    if (payoutDateFrom && r.payoutAt) {
                      if (new Date(r.payoutAt) < new Date(payoutDateFrom)) return false;
                    }
                    if (payoutDateTo && r.payoutAt) {
                      if (new Date(r.payoutAt) > new Date(payoutDateTo + "T23:59:59")) return false;
                    }
                    return true;
                  })
                  .sort((a, b) => {
                    if (filterSortBy === "name-asc") return (a.name || "").localeCompare(b.name || "");
                    if (filterSortBy === "name-desc") return (b.name || "").localeCompare(a.name || "");
                    if (filterSortBy === "interns-desc") return (b.internCount || 0) - (a.internCount || 0);
                    if (filterSortBy === "interns-asc") return (a.internCount || 0) - (b.internCount || 0);
                    if (filterSortBy === "achieved") return (b.achieved ? 1 : 0) - (a.achieved ? 1 : 0);
                    if (filterSortBy === "date-asc") return (a.createdAt || "").localeCompare(b.createdAt || "");
                    return (b.createdAt || "").localeCompare(a.createdAt || "");
                  })
                  .map((referral) => (
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
                        <div style={{ marginTop: "0.5rem" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "0.15rem 0.5rem",
                            fontSize: "0.68rem",
                            fontWeight: 900,
                            background: referral.achieved ? "#34A853" : "#eee",
                            color: referral.achieved ? "#fff" : "#888",
                            textTransform: "uppercase",
                            marginBottom: "0.35rem",
                          }}>
                            {referral.achieved ? "ACHIEVED" : "NOT ACHIEVED"}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { markReferralAchieved, fetchAdminReferralUsersWithInterns } = await import("../services/data");
                                await markReferralAchieved(referral.code, !referral.achieved);
                                setReferralUsersData(await fetchAdminReferralUsersWithInterns());
                                setSuccessMsg(referral.achieved ? "Achievement revoked." : "User marked as achieved!");
                                setTimeout(() => setSuccessMsg(""), 3000);
                              } catch (err) {
                                setError("Failed: " + err.message);
                              }
                            }}
                            style={{
                              padding: "0.25rem 0.65rem",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              border: "2px solid #34A853",
                              background: referral.achieved ? "#fff" : "#34A853",
                              color: referral.achieved ? "#34A853" : "#fff",
                              cursor: "pointer",
                              display: "block",
                              width: "100%",
                            }}
                          >
                            {referral.achieved ? "Revoke" : "Mark Achieved"}
                          </button>
                          {referral.achievedAt && (
                            <div style={{ fontSize: "0.65rem", color: "#34A853", marginTop: "0.25rem" }}>
                              {new Date(referral.achievedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: "0.5rem", borderTop: "1px solid #e0e0e0", paddingTop: "0.5rem" }}>
                          <div style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", color: "#555", marginBottom: "0.25rem" }}>Payout</div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>₹{referral.earnings || 0} earned ({referral.paidCompletedCount || 0} completed paid)</div>
                          <div style={{ fontSize: "0.72rem", marginTop: "0.15rem" }}>
                            Status: <span style={{ color: (referral.payoutStatus || "pending") === "done" ? "#34A853" : "#EA4335", fontWeight: 700 }}>{(referral.payoutStatus || "pending").toUpperCase()}</span>
                            {referral.payoutAt && <span> — {new Date(referral.payoutAt).toLocaleDateString()}</span>}
                          </div>
                          {(referral.payoutStatus || "pending") === "done" ? (
                            <button onClick={async () => { try { await clearReferralPayout(referral.code); const { fetchAdminReferralUsersWithInterns } = await import("../services/data"); setReferralUsersData(await fetchAdminReferralUsersWithInterns()); setSuccessMsg("Payout cleared."); setTimeout(() => setSuccessMsg(""), 3000); } catch (err) { setError(err.message); } }} style={{ padding: "0.25rem 0.65rem", fontSize: "0.7rem", fontWeight: 700, border: "2px solid #555", background: "#fff", color: "#555", cursor: "pointer", marginTop: "0.25rem", width: "100%" }}>Clear Payout</button>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.25rem" }}>
                              <input type="number" placeholder="Custom amount (₹)" defaultValue={referral.earnings || 0} onChange={(e) => { referral._customPayoutAmount = e.target.value; }} style={{ border: "2px solid #000", padding: "0.25rem 0.5rem", fontSize: "0.75rem", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
                              <button onClick={async () => { const amt = parseFloat(referral._customPayoutAmount || referral.earnings || 0); const note = prompt("Note (optional):") || ""; try { await markReferralPayout(referral.code, amt, note); const { fetchAdminReferralUsersWithInterns } = await import("../services/data"); setReferralUsersData(await fetchAdminReferralUsersWithInterns()); setSuccessMsg("Payout marked done."); setTimeout(() => setSuccessMsg(""), 3000); } catch (err) { setError(err.message); } }} style={{ padding: "0.25rem 0.65rem", fontSize: "0.7rem", fontWeight: 700, border: "2px solid #34A853", background: "#34A853", color: "#fff", cursor: "pointer", width: "100%" }}>Mark Payout Done</button>
                            </div>
                          )}
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
                          Assigned Interns ({(referral.internIds || referral.interns || []).length}{" "}
                          {(referral.internIds || referral.interns || []).length === 1
                            ? "Intern"
                            : "Interns"}
                          )
                        </div>
                        {referral.internCount <= 5 ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit,minmax(220px,1fr))",
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
                                    ).toLocaleString()}
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
                                {/* Show submission dates for each task */}
                                {intern.submissions && Object.keys(intern.submissions).length > 0 && (
                                  <div style={{ marginTop: "0.5rem", borderTop: "1px solid #eee", paddingTop: "0.4rem" }}>
                                    <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#888", marginBottom: "0.2rem" }}>
                                      Submissions:
                                    </div>
                                    {Object.entries(intern.submissions).map(([pIdx, sub]) => (
                                      <div key={pIdx} style={{ fontSize: "0.65rem", color: "#666", marginBottom: "0.15rem" }}>
                                        Task {parseInt(pIdx) + 1}: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : "-"}
                                        {sub.verified && " ✓"}
                                      </div>
                                    ))}
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
                                    {intern.submissions && Object.keys(intern.submissions).length > 0 && (
                                      <div style={{ marginTop: "0.4rem", borderTop: "1px solid #eee", paddingTop: "0.3rem" }}>
                                        <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", color: "#888", marginBottom: "0.15rem" }}>Tasks:</div>
                                        {Object.entries(intern.submissions).map(([pIdx, sub]) => (
                                          <div key={pIdx} style={{ fontSize: "0.62rem", color: "#666", marginBottom: "0.1rem" }}>
                                            T{parseInt(pIdx) + 1}: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : "-"}{sub.verified ? " ✓" : ""}
                                          </div>
                                        ))}
                                      </div>
                                    )}
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
              Runs entirely in your browser — no server needed. Uses Chrome built-in
              AI when available, or set <code>NVIDIA_API_KEY</code> on the backend in{" "}
              <code>client/.env</code> for NVIDIA LLM. Falls back to local checks if
              neither is available.
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
                  const isQuiz = (proj?.type || "text") === "quiz";
                  if (
                    sub &&
                    sub.submittedAt &&
                    sub.verified !== true &&
                    !sub.resubmit &&
                    !isQuiz
                  ) {
                    const projTitle =
                      typeof proj === "object" ? proj.title || "" : proj;
                    const projDesc =
                      typeof proj === "object" ? proj.description || "" : "";
                    const subText = sub.text || "";
                    const urlMatch = subText.match(/https?:\/\/[^\s<>"']+/);
                    const domainName = enrollment.domain || enrollment.domainId || "";
                    const taskDesc = projDesc || `Task: ${projTitle} — Part of the "${domainName}" internship program. Build a complete working implementation of this project.`;
                    unverifiedList.push({
                      key: `${enrollment.id}_${pIdx}`,
                      enrollmentId: enrollment.id,
                      projectIndex: pIdx,
                      projectTitle: projTitle,
                      projectDescription: taskDesc,
                      internName: enrollment.name,
                      internEmail: enrollment.email,
                      domain: domainName,
                      submissionText: subText,
                      submissionUrl: urlMatch ? urlMatch[0] : subText,
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
                                taskNotices: item.projectDescription,
                                submissionText: item.submissionText,
                                submissionUrl: item.submissionUrl || item.submissionText,
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
                                  const confidenceOk = (result.confidence || 0) >= 60;
                                  if (result.verified && confidenceOk) {
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
                              {result.verified && (result.confidence || 0) < 60 && (
                                <span style={{ fontSize: "0.72rem", color: "#EA4335", fontWeight: 700 }}>
                                  ⚠ LOW CONFIDENCE
                                </span>
                              )}
                              <span
                                style={{ fontSize: "0.72rem", color: "#888" }}
                              >
                                Confidence: {result.confidence}%
                              </span>
                              {result.codeFilesCount !== undefined && (
                                <span style={{ fontSize: "0.72rem", color: "#888" }}>
                                  | Files: {result.codeFilesCount}
                                </span>
                              )}
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
                                    taskNotices: item.projectDescription,
                                    submissionText: item.submissionText,
                                    submissionUrl: item.submissionUrl || item.submissionText,
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

        {/* ── VERIFY COMPLETION ── */}
        {activeTab === "verify-completion" && (
          <VerifyCompletionTab
            data={data}
            getProjectsForEnrollment={getProjectsForEnrollment}
            getSubmissions={getSubmissions}
            markEnrollmentComplete={markEnrollmentComplete}
            rejectEnrollmentCompletion={rejectEnrollmentCompletion}
            clearCompletionRejection={clearCompletionRejection}
            overrideCompleteEnrollment={overrideCompleteEnrollment}
            loadData={loadData}
            setSuccessMsg={setSuccessMsg}
            setError={setError}
            s={s}
            EmptyBox={EmptyBox}
          />
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
            {/* Earn Details Editor */}
            <div
              style={{
                border: "2px solid #000",
                padding: "1.5rem",
                boxShadow: "3px 3px 0 #000",
                marginTop: "1.5rem",
              }}
            >
              <h4
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  textTransform: "uppercase",
                  marginBottom: "1rem",
                }}
              >
                Details Modal Content
              </h4>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "#666",
                  marginBottom: "1rem",
                }}
              >
                This content appears in the "How It Works — Full Details" popup
                on the Earn section.
              </p>
              {earnDetailsLoading ? (
                <div style={{ color: "#888" }}>Loading…</div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.85rem",
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: "0.25rem",
                        textTransform: "uppercase",
                      }}
                    >
                      Modal Title
                    </label>
                    <input
                      type="text"
                      value={earnDetails.title}
                      onChange={(e) =>
                        setEarnDetails((d) => ({ ...d, title: e.target.value }))
                      }
                      style={s}
                      placeholder="How Refer & Earn Works"
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: "0.25rem",
                        textTransform: "uppercase",
                      }}
                    >
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={earnDetails.description}
                      onChange={(e) =>
                        setEarnDetails((d) => ({
                          ...d,
                          description: e.target.value,
                        }))
                      }
                      style={{ ...s, resize: "vertical" }}
                      placeholder="Short intro paragraph…"
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: "0.5rem",
                        textTransform: "uppercase",
                      }}
                    >
                      Steps / Items
                    </label>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {(earnDetails.items || []).map((item, i) => (
                        <div
                          key={i}
                          style={{
                            border: "1px solid #ddd",
                            padding: "0.75rem",
                            background: "#fafafa",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "0.5rem",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                color: "#555",
                              }}
                            >
                              Step {i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setEarnDetails((d) => ({
                                  ...d,
                                  items: d.items.filter((_, j) => j !== i),
                                }))
                              }
                              style={{
                                border: "1px solid #EA4335",
                                color: "#EA4335",
                                background: "none",
                                cursor: "pointer",
                                fontSize: "0.72rem",
                                padding: "0.1rem 0.4rem",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Title"
                            value={item.title}
                            onChange={(e) =>
                              setEarnDetails((d) => {
                                const items = [...d.items];
                                items[i] = {
                                  ...items[i],
                                  title: e.target.value,
                                };
                                return { ...d, items };
                              })
                            }
                            style={{ ...s, marginBottom: "0.4rem" }}
                          />
                          <textarea
                            rows={2}
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) =>
                              setEarnDetails((d) => {
                                const items = [...d.items];
                                items[i] = {
                                  ...items[i],
                                  description: e.target.value,
                                };
                                return { ...d, items };
                              })
                            }
                            style={{
                              ...s,
                              resize: "vertical",
                              marginBottom: "0.4rem",
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Links (comma-separated URLs)"
                            value={item.links}
                            onChange={(e) =>
                              setEarnDetails((d) => {
                                const items = [...d.items];
                                items[i] = {
                                  ...items[i],
                                  links: e.target.value,
                                };
                                return { ...d, items };
                              })
                            }
                            style={s}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEarnDetails((d) => ({
                          ...d,
                          items: [
                            ...(d.items || []),
                            { title: "", description: "", links: "" },
                          ],
                        }))
                      }
                      style={{
                        border: "2px solid #000",
                        background: "#fff",
                        cursor: "pointer",
                        padding: "0.35rem 0.9rem",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                      }}
                    >
                      + Add Step
                    </button>
                  </div>
                  <button
                    className="btn-sharp"
                    disabled={earnDetailsSaving}
                    onClick={async () => {
                      setEarnDetailsSaving(true);
                      try {
                        const { saveEarnDetails } =
                          await import("../services/data");
                        await saveEarnDetails(earnDetails);
                        setSuccessMsg("Earn details saved!");
                        setTimeout(() => setSuccessMsg(""), 3000);
                      } catch (err) {
                        setError("Failed to save earn details: " + err.message);
                      } finally {
                        setEarnDetailsSaving(false);
                      }
                    }}
                    style={{ padding: "0.7rem 2rem", alignSelf: "flex-start" }}
                  >
                    {earnDetailsSaving ? "Saving…" : "Save Details"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BANNED USERS ── */}
        {activeTab === "banned-users" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.5fr",
              gap: "2rem",
            }}
          >
            {/* Ban form */}
            <div
              style={{
                border: "2px solid #000",
                padding: "1.75rem",
                boxShadow: "4px 4px 0 #000",
              }}
            >
              <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>
                Ban User
              </h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!banEmail.trim()) return;
                  setBanActionLoading(true);
                  try {
                    const { banUser } = await import("../services/data");
                    await banUser(
                      banEmail.trim(),
                      banType,
                      banReason.trim(),
                      user?.email || "",
                    );
                    setBanEmail("");
                    setBanReason("");
                    setBanType("both");
                    setSuccessMsg("User banned successfully.");
                    const { fetchBannedUsers } =
                      await import("../services/data");
                    setBannedUsers(await fetchBannedUsers());
                    setTimeout(() => setSuccessMsg(""), 3000);
                  } catch (err) {
                    setError("Failed to ban user: " + err.message);
                  } finally {
                    setBanActionLoading(false);
                  }
                }}
              >
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.35rem",
                    textTransform: "uppercase",
                  }}
                >
                  User Email *
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={banEmail}
                  onChange={(e) => setBanEmail(e.target.value)}
                  style={{ ...s, marginBottom: "0.75rem" }}
                  required
                />
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.35rem",
                    textTransform: "uppercase",
                  }}
                >
                  Ban Type
                </label>
                <select
                  value={banType}
                  onChange={(e) => setBanType(e.target.value)}
                  style={{ ...s, marginBottom: "0.75rem", cursor: "pointer" }}
                >
                  <option value="both">Both (Internship + Earn)</option>
                  <option value="internship">Internship Only</option>
                  <option value="earn">Earn Only</option>
                </select>
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.35rem",
                    textTransform: "uppercase",
                  }}
                >
                  Reason (optional)
                </label>
                <input
                  type="text"
                  placeholder="Reason for ban…"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  style={{ ...s, marginBottom: "1rem" }}
                />
                <button
                  type="submit"
                  className="btn-sharp"
                  style={{
                    width: "100%",
                    backgroundColor: "#EA4335",
                    borderColor: "#EA4335",
                  }}
                  disabled={banActionLoading}
                >
                  {banActionLoading ? "Banning…" : "Ban User"}
                </button>
              </form>
            </div>

            {/* Banned list */}
            <div
              style={{
                border: "2px solid #000",
                padding: "1.75rem",
                boxShadow: "4px 4px 0 #000",
              }}
            >
              <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>
                Banned Users ({bannedUsers.length})
              </h3>
              {bannedUsersLoading ? (
                <div style={{ color: "#888" }}>Loading…</div>
              ) : bannedUsers.length === 0 ? (
                <EmptyBox msg="No banned users." />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  {bannedUsers.map((bu) => (
                    <div
                      key={bu.id}
                      style={{
                        border: "2px solid #EA4335",
                        padding: "0.85rem 1rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        background: "#FFF5F5",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>
                          {bu.email}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#EA4335",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            marginTop: "0.15rem",
                          }}
                        >
                          {bu.banType === "both"
                            ? "Internship + Earn"
                            : bu.banType === "internship"
                              ? "Internship"
                              : "Earn"}{" "}
                          banned
                        </div>
                        {bu.reason && (
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color: "#555",
                              marginTop: "0.2rem",
                            }}
                          >
                            Reason: {bu.reason}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "#888",
                            marginTop: "0.15rem",
                          }}
                        >
                          {new Date(bu.bannedAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={banActionLoading}
                        onClick={async () => {
                          setBanActionLoading(true);
                          try {
                            const { unbanUser, fetchBannedUsers } =
                              await import("../services/data");
                            await unbanUser(bu.email);
                            setBannedUsers(await fetchBannedUsers());
                            setSuccessMsg("User unbanned.");
                            setTimeout(() => setSuccessMsg(""), 3000);
                          } catch (err) {
                            setError("Failed to unban: " + err.message);
                          } finally {
                            setBanActionLoading(false);
                          }
                        }}
                        style={{
                          padding: "0.3rem 0.8rem",
                          border: "2px solid #34A853",
                          background: "#fff",
                          color: "#34A853",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: "0.78rem",
                        }}
                      >
                        Unban
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MESSAGES ── */}
        {activeTab === "messages" && (
          <div
            className="admin-messages-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.5fr",
              gap: "2rem",
            }}
          >
            {/* Compose */}
            <div
              style={{
                border: "2px solid #000",
                padding: "1.75rem",
                boxShadow: "4px 4px 0 #000",
              }}
            >
              <h3 style={{ fontWeight: 800, marginBottom: "0.5rem" }}>
                Send Message
              </h3>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "#666",
                  marginBottom: "1rem",
                }}
              >
                Messages appear as banners on the student dashboard. Set an
                expiry — after that they disappear automatically.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newMessage.text.trim()) return;
                  setMessagesSaving(true);
                  try {
                    const { saveAdminMessage, fetchAllAdminMessages } =
                      await import("../services/data");
                    await saveAdminMessage({
                      ...newMessage,
                      createdBy: user?.email || "",
                    });
                    setNewMessage({
                      title: "",
                      text: "",
                      type: "info",
                      target: "all",
                      expiresAt: "",
                    });
                    setAdminMessages(await fetchAllAdminMessages());
                    setSuccessMsg("Message sent!");
                    setTimeout(() => setSuccessMsg(""), 3000);
                  } catch (err) {
                    setError("Failed to send message: " + err.message);
                  } finally {
                    setMessagesSaving(false);
                  }
                }}
              >
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.35rem",
                    textTransform: "uppercase",
                  }}
                >
                  Title (optional)
                </label>
                <input
                  type="text"
                  placeholder="Message title…"
                  value={newMessage.title}
                  onChange={(e) =>
                    setNewMessage((m) => ({ ...m, title: e.target.value }))
                  }
                  style={{ ...s, marginBottom: "0.75rem" }}
                />
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.35rem",
                    textTransform: "uppercase",
                  }}
                >
                  Message *
                </label>
                <textarea
                  rows={3}
                  placeholder="Write your message…"
                  value={newMessage.text}
                  onChange={(e) =>
                    setNewMessage((m) => ({ ...m, text: e.target.value }))
                  }
                  style={{ ...s, resize: "vertical", marginBottom: "0.75rem" }}
                  required
                />
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.35rem",
                    textTransform: "uppercase",
                  }}
                >
                  Type
                </label>
                <select
                  value={newMessage.type}
                  onChange={(e) =>
                    setNewMessage((m) => ({ ...m, type: e.target.value }))
                  }
                  style={{ ...s, marginBottom: "0.75rem", cursor: "pointer" }}
                >
                  <option value="info">ℹ Info</option>
                  <option value="warning">⚠ Warning</option>
                  <option value="success">✓ Success</option>
                  <option value="notice">📌 Notice (box in dashboard, non-dismissible)</option>
                </select>
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.35rem",
                    textTransform: "uppercase",
                  }}
                >
                  Send To
                </label>
                <input
                  type="text"
                  placeholder="all — or type a specific email"
                  value={newMessage.target}
                  onChange={(e) =>
                    setNewMessage((m) => ({ ...m, target: e.target.value }))
                  }
                  style={{ ...s, marginBottom: "0.75rem" }}
                />
                <label
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.35rem",
                    textTransform: "uppercase",
                  }}
                >
                  Expires At (date &amp; time)
                </label>
                <input
                  type="datetime-local"
                  value={newMessage.expiresAt}
                  onChange={(e) =>
                    setNewMessage((m) => ({ ...m, expiresAt: e.target.value }))
                  }
                  style={{ ...s, marginBottom: "1rem" }}
                />
                <button
                  type="submit"
                  className="btn-sharp"
                  style={{ width: "100%" }}
                  disabled={messagesSaving}
                >
                  {messagesSaving ? "Sending…" : "Send Message"}
                </button>
              </form>
            </div>

            {/* All messages */}
            <div
              style={{
                border: "2px solid #000",
                padding: "1.75rem",
                boxShadow: "4px 4px 0 #000",
              }}
            >
              <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>
                All Messages ({adminMessages.length})
              </h3>
              {messagesLoading ? (
                <div style={{ color: "#888" }}>Loading…</div>
              ) : adminMessages.length === 0 ? (
                <EmptyBox msg="No messages yet." />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.85rem",
                    maxHeight: "520px",
                    overflowY: "auto",
                  }}
                >
                  {adminMessages.map((msg) => {
                    const isExpired =
                      msg.expiresAt && new Date(msg.expiresAt) < new Date();
                    const typeColor =
                      msg.type === "warning"
                        ? "#FBBC05"
                        : msg.type === "success"
                          ? "#34A853"
                          : msg.type === "notice"
                            ? "#9334EA"
                            : "#4285F4";
                    return (
                      <div
                        key={msg.id}
                        style={{
                          border: `2px solid ${typeColor}`,
                          padding: "0.85rem 1rem",
                          background: isExpired ? "#f5f5f5" : "#fff",
                          opacity: isExpired ? 0.6 : 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "0.5rem",
                            marginBottom: "0.35rem",
                          }}
                        >
                          <div>
                            {msg.title && (
                              <div
                                style={{ fontWeight: 800, fontSize: "0.9rem" }}
                              >
                                {msg.title}
                              </div>
                            )}
                            <div
                              style={{
                                fontSize: "0.85rem",
                                color: "#333",
                                marginTop: msg.title ? "0.2rem" : 0,
                              }}
                            >
                              {msg.text}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const {
                                  deleteAdminMessage,
                                  fetchAllAdminMessages,
                                } = await import("../services/data");
                                await deleteAdminMessage(msg.id);
                                setAdminMessages(await fetchAllAdminMessages());
                              } catch (err) {
                                setError("Failed to delete: " + err.message);
                              }
                            }}
                            style={{
                              border: "1px solid #EA4335",
                              color: "#EA4335",
                              background: "none",
                              cursor: "pointer",
                              padding: "0.1rem 0.4rem",
                              fontSize: "0.75rem",
                              flexShrink: 0,
                            }}
                          >
                            Delete
                          </button>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "1rem",
                            flexWrap: "wrap",
                            fontSize: "0.72rem",
                            color: "#888",
                            marginTop: "0.4rem",
                          }}
                        >
                          <span>
                            To:{" "}
                            <strong>
                              {msg.target === "all" ? "Everyone" : msg.target}
                            </strong>
                          </span>
                          <span>
                            Type:{" "}
                            <strong style={{ color: typeColor }}>
                              {msg.type}
                            </strong>
                          </span>
                          {msg.expiresAt && (
                            <span
                              style={{ color: isExpired ? "#EA4335" : "#888" }}
                            >
                              Expires:{" "}
                              {new Date(msg.expiresAt).toLocaleString()}{" "}
                              {isExpired ? "(expired)" : ""}
                            </span>
                          )}
                          <span>
                            Sent: {new Date(msg.createdAt).toLocaleString()}
                          </span>
                          {msg.context && (
                            <span>
                              Tab: <strong>{msg.context}</strong>
                            </span>
                          )}
                          {msg.requireAck && (
                            <span
                              style={{
                                color:
                                  msg.pendingCount > 0 ? "#EA4335" : "#34A853",
                                fontWeight: 700,
                              }}
                            >
                              {msg.pendingCount > 0
                                ? `Pending Done: ${msg.pendingCount} user(s) remaining`
                                : "All users marked Done"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 13. NOTICE BOARD ── */}
        {activeTab === "notice-board" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.5fr",
              gap: "2rem",
            }}
          >
            {/* Compose Notice */}
            <div
              style={{
                border: "2px solid #000",
                padding: "1.75rem",
                boxShadow: "4px 4px 0 #000",
              }}
            >
              <h3 style={{ fontWeight: 800, marginBottom: "0.5rem" }}>
                Add Notice
              </h3>
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "#666",
                  marginBottom: "1rem",
                }}
              >
                Notices appear as always-visible boxes on user dashboards (Internship & Referral).
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newNotice.text.trim()) return;
                  setNoticeSaving(true);
                  try {
                    const { saveSiteNotice, fetchSiteNotices } = await import("../services/data");
                    await saveSiteNotice({
                      ...newNotice,
                      createdBy: user?.email || "",
                    });
                    setNewNotice({ title: "", text: "", type: "info", context: "all" });
                    setSiteNotices(await fetchSiteNotices());
                    setSuccessMsg("Notice added!");
                    setTimeout(() => setSuccessMsg(""), 3000);
                  } catch (err) {
                    setError("Failed to add notice: " + err.message);
                  } finally {
                    setNoticeSaving(false);
                  }
                }}
              >
                <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>
                  Title (optional)
                </label>
                <input type="text" placeholder="Notice title…" value={newNotice.title} onChange={(e) => setNewNotice((n) => ({ ...n, title: e.target.value }))} style={{ ...s, marginBottom: "0.75rem" }} />
                <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>
                  Notice Text *
                </label>
                <textarea rows={3} placeholder="Write notice content…" value={newNotice.text} onChange={(e) => setNewNotice((n) => ({ ...n, text: e.target.value }))} style={{ ...s, resize: "vertical", marginBottom: "0.75rem" }} required />
                <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>
                  Type
                </label>
                <select value={newNotice.type} onChange={(e) => setNewNotice((n) => ({ ...n, type: e.target.value }))} style={{ ...s, marginBottom: "0.75rem", cursor: "pointer" }}>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>
                  Show On
                </label>
                <select value={newNotice.context} onChange={(e) => setNewNotice((n) => ({ ...n, context: e.target.value }))} style={{ ...s, marginBottom: "1rem", cursor: "pointer" }}>
                  <option value="all">Both Dashboards</option>
                  <option value="intern">Internship Dashboard</option>
                  <option value="referral">Referral Dashboard</option>
                </select>
                <button type="submit" className="btn-sharp" style={{ width: "100%" }} disabled={noticeSaving}>
                  {noticeSaving ? "Adding…" : "Add Notice"}
                </button>
              </form>
            </div>

            {/* All Notices */}
            <div
              style={{
                border: "2px solid #000",
                padding: "1.75rem",
                boxShadow: "4px 4px 0 #000",
              }}
            >
              <h3 style={{ fontWeight: 800, marginBottom: "1rem" }}>
                Active Notices ({siteNotices.length})
              </h3>
              {noticesLoading ? (
                <div style={{ color: "#888" }}>Loading…</div>
              ) : siteNotices.length === 0 ? (
                <EmptyBox msg="No notices yet. Create one to show on user dashboards." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", maxHeight: "520px", overflowY: "auto" }}>
                  {siteNotices.map((notice) => {
                    const typeColor = notice.type === "warning" ? "#FBBC05" : notice.type === "success" ? "#34A853" : "#4285F4";
                    return (
                      <div key={notice.id} style={{ border: `2px solid ${typeColor}`, padding: "0.85rem 1rem", background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.35rem" }}>
                          <div>
                            {notice.title && <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{notice.title}</div>}
                            <div style={{ fontSize: "0.85rem", color: "#333", marginTop: notice.title ? "0.2rem" : 0 }}>{notice.text}</div>
                          </div>
                          <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
                            <button type="button" onClick={async () => {
                              try {
                                const { toggleSiteNotice, fetchSiteNotices } = await import("../services/data");
                                await toggleSiteNotice(notice.id, false);
                                setSiteNotices(await fetchSiteNotices());
                                setSuccessMsg("Notice deactivated.");
                                setTimeout(() => setSuccessMsg(""), 3000);
                              } catch (err) { setError("Failed: " + err.message); }
                            }} style={{ border: "1px solid #EA4335", color: "#EA4335", background: "none", cursor: "pointer", padding: "0.1rem 0.4rem", fontSize: "0.75rem" }}>Deactivate</button>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.72rem", color: "#888", marginTop: "0.4rem" }}>
                          <span>Context: <strong>{notice.context === "all" ? "Both" : notice.context === "intern" ? "Internship" : "Referral"}</strong></span>
                          <span>Type: <strong style={{ color: typeColor }}>{notice.type}</strong></span>
                          <span>Created: {new Date(notice.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 14. HOMEPAGE EDITOR ── */}
        {activeTab === "homepage" && (
          <div style={{ maxWidth: "800px" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "1rem" }}>Homepage Content Editor</h3>
            {homepageLoading ? (
              <div style={{ color: "#888" }}>Loading…</div>
            ) : homepageContent ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Headline */}
                <div style={{ border: "2px solid #000", padding: "1.5rem", boxShadow: "3px 3px 0 #000" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>Headline (H1)</label>
                  <textarea rows={2} value={homepageContent.headline || ""} onChange={(e) => setHomepageContent((p) => ({ ...p, headline: e.target.value }))} style={{ ...s, resize: "vertical", marginBottom: "1rem", fontSize: "1.1rem", fontWeight: 900 }} />
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, display: "block", marginBottom: "0.35rem", textTransform: "uppercase" }}>Description (Paragraph)</label>
                  <textarea rows={3} value={homepageContent.description || ""} onChange={(e) => setHomepageContent((p) => ({ ...p, description: e.target.value }))} style={{ ...s, resize: "vertical", fontSize: "0.95rem" }} />
                </div>

                {/* Badges */}
                <div style={{ border: "2px solid #000", padding: "1.5rem", boxShadow: "3px 3px 0 #000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.9rem", textTransform: "uppercase" }}>Badge Tags</span>
                    <button type="button" onClick={() => setHomepageContent((p) => ({ ...p, badges: [...(p.badges || []), { label: "New Badge" }] }))} style={{ border: "2px solid #000", background: "#fff", cursor: "pointer", padding: "0.2rem 0.6rem", fontSize: "0.78rem", fontWeight: 700 }}>+ Add Badge</button>
                  </div>
                  {(homepageContent.badges || []).map((badge, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                      <input value={badge.label} onChange={(e) => { const u = [...homepageContent.badges]; u[idx] = { ...u[idx], label: e.target.value }; setHomepageContent((p) => ({ ...p, badges: u })); }} style={{ ...s, flex: 1 }} />
                      <button type="button" onClick={() => setHomepageContent((p) => ({ ...p, badges: p.badges.filter((_, i) => i !== idx) }))} style={{ border: "1px solid #EA4335", color: "#EA4335", background: "none", cursor: "pointer", padding: "0.15rem 0.4rem", fontSize: "0.75rem" }}>Remove</button>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div style={{ border: "2px solid #000", padding: "1.5rem", boxShadow: "3px 3px 0 #000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.9rem", textTransform: "uppercase" }}>CTA Buttons</span>
                    <button type="button" onClick={() => setHomepageContent((p) => ({ ...p, buttons: [...(p.buttons || []), { label: "New Button", action: "apply", enabled: true }] }))} style={{ border: "2px solid #000", background: "#fff", cursor: "pointer", padding: "0.2rem 0.6rem", fontSize: "0.78rem", fontWeight: 700 }}>+ Add Button</button>
                  </div>
                  {(homepageContent.buttons || []).map((btn, idx) => (
                    <div key={idx} style={{ border: "1px solid #ddd", padding: "0.85rem", marginBottom: "0.75rem", background: "#fafafa" }}>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                        <input value={btn.label} onChange={(e) => { const u = [...homepageContent.buttons]; u[idx] = { ...u[idx], label: e.target.value }; setHomepageContent((p) => ({ ...p, buttons: u })); }} placeholder="Button label" style={{ ...s, flex: 1 }} />
                        <select value={btn.action || "apply"} onChange={(e) => { const u = [...homepageContent.buttons]; u[idx] = { ...u[idx], action: e.target.value }; setHomepageContent((p) => ({ ...p, buttons: u })); }} style={{ ...s, width: "auto", cursor: "pointer" }}>
                          <option value="apply">Apply Internship</option>
                          <option value="explore">Explore Domains</option>
                        </select>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem", whiteSpace: "nowrap" }}>
                          <input type="checkbox" checked={btn.enabled !== false} onChange={(e) => { const u = [...homepageContent.buttons]; u[idx] = { ...u[idx], enabled: e.target.checked }; setHomepageContent((p) => ({ ...p, buttons: u })); }} /> Enabled
                        </label>
                        <button type="button" onClick={() => setHomepageContent((p) => ({ ...p, buttons: p.buttons.filter((_, i) => i !== idx) }))} style={{ border: "1px solid #EA4335", color: "#EA4335", background: "none", cursor: "pointer", padding: "0.15rem 0.4rem", fontSize: "0.75rem" }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div style={{ border: "2px solid #000", padding: "1.5rem", boxShadow: "3px 3px 0 #000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.9rem", textTransform: "uppercase" }}>Feature Highlights</span>
                    <button type="button" onClick={() => setHomepageContent((p) => ({ ...p, features: [...(p.features || []), { icon: "✓", label: "New Feature" }] }))} style={{ border: "2px solid #000", background: "#fff", cursor: "pointer", padding: "0.2rem 0.6rem", fontSize: "0.78rem", fontWeight: 700 }}>+ Add Feature</button>
                  </div>
                  {(homepageContent.features || []).map((feat, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                      <input value={feat.icon} onChange={(e) => { const u = [...homepageContent.features]; u[idx] = { ...u[idx], icon: e.target.value }; setHomepageContent((p) => ({ ...p, features: u })); }} style={{ ...s, width: "60px" }} placeholder="Icon" />
                      <input value={feat.label} onChange={(e) => { const u = [...homepageContent.features]; u[idx] = { ...u[idx], label: e.target.value }; setHomepageContent((p) => ({ ...p, features: u })); }} style={{ ...s, flex: 1 }} placeholder="Feature text" />
                      <button type="button" onClick={() => setHomepageContent((p) => ({ ...p, features: p.features.filter((_, i) => i !== idx) }))} style={{ border: "1px solid #EA4335", color: "#EA4335", background: "none", cursor: "pointer", padding: "0.15rem 0.4rem", fontSize: "0.75rem" }}>Remove</button>
                    </div>
                  ))}
                </div>

                <button className="btn-sharp" disabled={homepageSaving} onClick={async () => {
                  setHomepageSaving(true);
                  try {
                    const { saveHomepageContent } = await import("../services/data");
                    await saveHomepageContent(homepageContent);
                    setSuccessMsg("Homepage content saved!");
                    setTimeout(() => setSuccessMsg(""), 3000);
                  } catch (err) { setError("Failed to save: " + err.message); }
                  finally { setHomepageSaving(false); }
                }} style={{ alignSelf: "flex-start", padding: "0.7rem 2rem" }}>
                  {homepageSaving ? "Saving…" : "Save Homepage"}
                </button>
              </div>
            ) : (
              <EmptyBox msg="Could not load homepage content." />
            )}
          </div>
        )}

        {/* ── 15. MANAGE ADMINS ── */}
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
                    generateAndPrint(templates.templates?.["Offer Letter"] || "", { ...selectedIntern, date });
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
                      const rawLinks =
                        typeof project === "object" ? project.links : [];
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
                      const projectLinks = normalizeLinks(rawLinks);

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
                                {(project?.type || "text") === "quiz" && (
                                  <span
                                    style={{
                                      marginLeft: "0.5rem",
                                      background: "#FBBC05",
                                      color: "#5a4000",
                                      fontSize: "0.6rem",
                                      fontWeight: 900,
                                      padding: "0.15rem 0.4rem",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    Quiz
                                  </span>
                                )}
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
                              {projectLinks.length > 0 && (
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "#777",
                                    marginTop: "0.3rem",
                                  }}
                                >
                                  <strong>Resources:</strong>
                                  {projectLinks.map((group, gi) => (
                                    <div key={gi} style={{ marginTop: "0.2rem" }}>
                                      {group.title && (
                                        <div style={{ fontWeight: 700, color: "#555", marginBottom: "0.15rem" }}>
                                          {group.title}
                                        </div>
                                      )}
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
                                              marginRight: "0.5rem",
                                              fontWeight: 700,
                                              display: "inline-block",
                                            }}
                                          >
                                            {item.text || `Link ${ii + 1}`}
                                          </a>
                                        );
                                      })}
                                    </div>
                                  ))}
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
                                <>
                                  <span
                                    style={{
                                      background: "#34A853",
                                      color: "#fff",
                                      fontSize: "0.7rem",
                                      fontWeight: 900,
                                      padding: "0.2rem 0.6rem",
                                    }}
                                  >
                                    {sub?.verifiedBy === "ai" ? "AI VERIFIED" : "VERIFIED"}
                                  </span>
                                  <button
                                    onClick={() => handleUnverifyTask(selectedIntern.id, idx)}
                                    disabled={actionLoading[`unverify-task-${selectedIntern.id}-${idx}`]}
                                    style={{
                                      padding: "0.2rem 0.6rem",
                                      fontSize: "0.72rem",
                                      fontWeight: 700,
                                      border: "2px solid #EA4335",
                                      background: actionLoading[`unverify-task-${selectedIntern.id}-${idx}`] ? "#EA4335" : "#fff",
                                      color: actionLoading[`unverify-task-${selectedIntern.id}-${idx}`] ? "#fff" : "#EA4335",
                                      cursor: "pointer",
                                      borderRadius: 0,
                                    }}
                                  >
                                    {actionLoading[`unverify-task-${selectedIntern.id}-${idx}`] ? "…" : "Unverify"}
                                  </button>
                                </>
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
                              {sub.quizScore !== undefined && (
                                <div
                                  style={{
                                    fontSize: "0.82rem",
                                    marginTop: "0.35rem",
                                    color: sub.quizPassed ? "#34A853" : "#EA4335",
                                    fontWeight: 700,
                                  }}
                                >
                                  Quiz Score: {sub.quizScore}% —{" "}
                                  {sub.quizPassed ? "PASSED" : "FAILED"}
                                </div>
                              )}
                              {sub.quizResults && (Object.keys(sub.quizResults).length > 0) && (
                                <div style={{ fontSize: "0.78rem", marginTop: "0.3rem" }}>
                                  {(project?.quizQuestions || []).map((q, qi) => {
                                    const r = sub.quizResults[qi];
                                    if (r === undefined) return null;
                                    return (
                                      <div key={qi} style={{ marginBottom: "0.35rem", padding: "0.3rem 0.5rem", background: "#f9f9f9", border: "1px solid #eee" }}>
                                        <div><strong>Q{qi + 1}:</strong> {q.question}</div>
                                        <div style={{ fontSize: "0.75rem", color: "#555", marginTop: "0.15rem" }}>
                                          Submitted: <strong>{sub.quizAnswers?.[qi] ?? "(empty)"}</strong>
                                          {q.answer !== undefined && q.answer !== "" && (
                                            <span style={{ marginLeft: "0.75rem" }}>Correct: <strong style={{ color: "#34A853" }}>{q.answer}</strong></span>
                                          )}
                                          {r === true && <span style={{ color: "#34A853", marginLeft: "0.5rem" }}>✓ Correct</span>}
                                          {r === false && <span style={{ color: "#EA4335", marginLeft: "0.5rem" }}>✗ Incorrect</span>}
                                          {r === null && <span style={{ color: "#888", marginLeft: "0.5rem" }}>⏳ Pending</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {selectedIntern.paymentStatus && (
                  <span style={{ fontSize: "0.8rem", color: "#333" }}>
                    <strong>Payment:</strong>{" "}
                    <span style={{ color: selectedIntern.paymentStatus === "paid" ? "#34A853" : "#EA4335", fontWeight: 800 }}>
                      {selectedIntern.paymentStatus.toUpperCase()}
                    </span>
                    {selectedIntern.paymentAmount && <span> (₹{selectedIntern.paymentAmount})</span>}
                  </span>
                )}
                {selectedIntern.paymentStatus === "paid" && (
                  <button
                    type="button"
                    onClick={() => handleUnverifyPayment(selectedIntern.id)}
                    disabled={actionLoading[`unverify-pay-${selectedIntern.id}`]}
                    style={{
                      padding: "0.3rem 0.85rem",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      border: "2px solid #EA4335",
                      background: actionLoading[`unverify-pay-${selectedIntern.id}`] ? "#EA4335" : "#fff",
                      color: actionLoading[`unverify-pay-${selectedIntern.id}`] ? "#fff" : "#EA4335",
                      cursor: "pointer",
                      borderRadius: 0,
                    }}
                  >
                    {actionLoading[`unverify-pay-${selectedIntern.id}`] ? "…" : "Unverify Payment"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
                <input type="number" placeholder="Set custom amount (₹)" defaultValue={selectedIntern.paymentAmount || ""} onChange={(e) => { selectedIntern._customAmount = e.target.value; }} style={{ border: "2px solid #000", padding: "0.3rem 0.5rem", fontSize: "0.78rem", fontFamily: "inherit", outline: "none", width: "140px" }} />
                <button onClick={async () => {
                  const amt = parseFloat(selectedIntern._customAmount);
                  if (!amt || isNaN(amt)) return alert("Enter a valid amount");
                  try {
                    await setPaymentAmount(selectedIntern.id, amt);
                    const updated = await fetchEnrollmentById(selectedIntern.id);
                    if (updated) setSelectedIntern(updated);
                    await loadData();
                    setSuccessMsg("Payment amount updated to ₹" + amt);
                    setTimeout(() => setSuccessMsg(""), 3000);
                  } catch (err) { setError("Failed: " + err.message); }
                }} style={{ padding: "0.3rem 0.85rem", fontSize: "0.78rem", fontWeight: 800, border: "2px solid #4285F4", background: "#4285F4", color: "#fff", cursor: "pointer", borderRadius: 0 }}>
                  Set Amount
                </button>
              </div>

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

      {quickMessageTarget && (
        <div
          className="modal-overlay"
          onClick={() => !quickMessageSaving && setQuickMessageTarget(null)}
        >
          <div
            className="modal-content admin-quick-message-modal"
            style={{
              background: "#fff",
              border: "2px solid #000",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "480px",
              margin: "1rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontWeight: 800, marginBottom: "0.5rem" }}>
              Send Message
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#666", marginBottom: "1rem" }}>
              To: <strong>{quickMessageTarget.name || quickMessageTarget.email}</strong>{" "}
              ({quickMessageTarget.context} tab only, no expiry — user must click Done)
            </p>
            <form onSubmit={handleSendQuickMessage}>
              <textarea
                rows={4}
                value={quickMessageText}
                onChange={(e) => setQuickMessageText(e.target.value)}
                placeholder="Write your message…"
                style={{ ...s, resize: "vertical", marginBottom: "1rem" }}
                required
              />
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  className="btn-sharp"
                  disabled={quickMessageSaving}
                  style={{ flex: 1, minWidth: "120px" }}
                >
                  {quickMessageSaving ? "Sending…" : "Send"}
                </button>
                <button
                  type="button"
                  className="btn-sharp-outline"
                  disabled={quickMessageSaving}
                  onClick={() => setQuickMessageTarget(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quiz Questions Modal ── */}
      {quizModalDomainIdx !== null && quizModalProjIdx !== null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 2000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onClick={() => {
            setQuizModalDomainIdx(null);
            setQuizModalProjIdx(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              border: "2px solid #000",
              boxShadow: "12px 12px 0 #000",
              padding: "2rem",
              maxWidth: "700px",
              width: "90vw",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h4
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                textTransform: "uppercase",
                marginBottom: "1rem",
              }}
            >
              Edit Quiz Questions
            </h4>
            {quizModalQuestions.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: "#888", fontStyle: "italic", marginBottom: "1rem" }}>
                No questions yet. Add your first question below.
              </p>
            )}
            {quizModalQuestions.map((q, qi) => (
              <div
                key={qi}
                style={{
                  border: "2px solid #000",
                  padding: "1rem",
                  marginBottom: "1rem",
                  background: "#fafafa",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <strong style={{ fontSize: "0.8rem" }}>Question #{qi + 1}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      setQuizModalQuestions(quizModalQuestions.filter((_, i) => i !== qi));
                    }}
                    style={{
                      border: "2px solid #EA4335",
                      color: "#EA4335",
                      background: "#fff",
                      cursor: "pointer",
                      padding: "0.15rem 0.4rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                    }}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ marginBottom: "0.4rem" }}>
                  <input
                    className="input-sharp"
                    value={q.question || ""}
                    onChange={(e) => {
                      const u = [...quizModalQuestions];
                      u[qi] = { ...u[qi], question: e.target.value };
                      setQuizModalQuestions(u);
                    }}
                    placeholder="Enter the question"
                    style={{ ...s, width: "100%" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem", alignItems: "center" }}>
                  <label style={{ fontSize: "0.7rem", fontWeight: 700, flexShrink: 0 }}>Type:</label>
                  <select
                    className="input-sharp"
                    value={q.type || "text"}
                    onChange={(e) => {
                      const u = [...quizModalQuestions];
                      u[qi] = { ...u[qi], type: e.target.value, options: e.target.value === "option" ? (u[qi].options || ["", ""]) : [], answer: "" };
                      setQuizModalQuestions(u);
                    }}
                    style={{ ...s, width: "auto" }}
                  >
                    <option value="text">Text Input (admin verifies)</option>
                    <option value="option">Multiple Choice</option>
                    <option value="number">Number Input</option>
                  </select>
                </div>
                {q.type === "option" && (
                  <div style={{ marginBottom: "0.4rem" }}>
                    <label style={{ fontSize: "0.7rem", fontWeight: 700, display: "block", marginBottom: "0.2rem" }}>
                      Options
                    </label>
                    {(q.options || []).map((opt, oi) => (
                      <div key={oi} style={{ display: "flex", gap: "0.3rem", marginBottom: "0.3rem", alignItems: "center" }}>
                        <input
                          className="input-sharp"
                          value={opt}
                          onChange={(e) => {
                            const u = [...quizModalQuestions];
                            const opts = [...(u[qi].options || [])];
                            opts[oi] = e.target.value;
                            u[qi] = { ...u[qi], options: opts };
                            setQuizModalQuestions(u);
                          }}
                          placeholder={`Option ${oi + 1}`}
                          style={{ ...s, flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const u = [...quizModalQuestions];
                            u[qi] = { ...u[qi], options: (u[qi].options || []).filter((_, i) => i !== oi) };
                            setQuizModalQuestions(u);
                          }}
                          style={{
                            border: "2px solid #EA4335",
                            color: "#EA4335",
                            background: "#fff",
                            cursor: "pointer",
                            padding: "0.15rem 0.4rem",
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          X
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const u = [...quizModalQuestions];
                        u[qi] = { ...u[qi], options: [...(u[qi].options || []), ""] };
                        setQuizModalQuestions(u);
                      }}
                      style={{
                        border: "2px solid #000",
                        color: "#000",
                        background: "#fff",
                        cursor: "pointer",
                        padding: "0.2rem 0.6rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        marginTop: "0.2rem",
                      }}
                    >
                      + Add Option
                    </button>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: "0.7rem", fontWeight: 700, display: "block", marginBottom: "0.2rem" }}>
                    {q.type === "text"
                      ? "Text Answer (not auto-graded)"
                      : q.type === "number"
                        ? "Correct Number Answer"
                        : "Correct Answer"}
                  </label>
                  {q.type === "option" ? (
                    <select
                      className="input-sharp"
                      value={q.answer || ""}
                      onChange={(e) => {
                        const u = [...quizModalQuestions];
                        u[qi] = { ...u[qi], answer: e.target.value };
                        setQuizModalQuestions(u);
                      }}
                      style={s}
                    >
                      <option value="">-- Select --</option>
                      {(q.options || []).map((opt, oi) => (
                        <option key={oi} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input-sharp"
                      type={q.type === "number" ? "number" : "text"}
                      value={q.answer || ""}
                      onChange={(e) => {
                        const u = [...quizModalQuestions];
                        u[qi] = { ...u[qi], answer: e.target.value };
                        setQuizModalQuestions(u);
                      }}
                      placeholder={q.type === "text" ? "Leave blank (not auto-graded)" : "Enter correct answer"}
                      style={s}
                    />
                  )}
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => {
                  setQuizModalQuestions([...quizModalQuestions, { question: "", type: "text", options: [], answer: "" }]);
                }}
                style={{
                  border: "2px solid #000",
                  color: "#000",
                  background: "#fff",
                  cursor: "pointer",
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                }}
              >
                + Add Question
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = JSON.parse(JSON.stringify(careerPaths));
                  const target = u[quizModalDomainIdx].projects[quizModalProjIdx];
                  if (typeof target === "object") {
                    target.quizQuestions = JSON.parse(JSON.stringify(quizModalQuestions));
                  }
                  setCareerPaths(u);
                  setQuizModalDomainIdx(null);
                  setQuizModalProjIdx(null);
                }}
                style={{
                  border: "2px solid #34A853",
                  color: "#fff",
                  background: "#34A853",
                  cursor: "pointer",
                  padding: "0.5rem 1.5rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                }}
              >
                Save Questions
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuizModalDomainIdx(null);
                  setQuizModalProjIdx(null);
                }}
                style={{
                  border: "2px solid #000",
                  color: "#000",
                  background: "#fff",
                  cursor: "pointer",
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                }}
              >
                Cancel
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
  if (!rows || !rows.length) return <EmptyBox msg={empty} />;
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

function VerifyCompletionTab({ data, getProjectsForEnrollment, getSubmissions, markEnrollmentComplete, rejectEnrollmentCompletion, clearCompletionRejection, loadData, setSuccessMsg, setError, s, EmptyBox, overrideCompleteEnrollment }) {
  const [rejectTexts, setRejectTexts] = useState({});
  const [completing, setCompleting] = useState({});
  const [rejecting, setRejecting] = useState({});
  const [overrideLoading, setOverrideLoading] = useState({});
  const [verifySearch, setVerifySearch] = useState("");
  const isCompletionReady = (e) => {
    const projects = getProjectsForEnrollment(e);
    if (projects.length === 0) return { ready: false, reason: "No projects assigned" };
    const subs = getSubmissions(e);
    const allVerified = projects.every((_, i) => subs[i]?.verified);
    if (!allVerified) return { ready: false, reason: "Not all tasks verified" };
    const isPaid = e.paymentTiming === "both" ? e.paymentStage === "fully_paid" : e.paymentStatus === "paid";
    if (!isPaid) return { ready: false, reason: "Payment not completed" };
    return { ready: true, reason: "" };
  };
  const pendingComplete = data.requests.filter((e) => {
    if (e.status === "Completed" || e.status === "Archived") return false;
    const check = isCompletionReady(e);
    return check.ready || true; // Show all that are eligible OR almost eligible
  });
  return (
    <div style={{ maxWidth: "900px" }}>
      <h3 style={{ fontSize: "1.2rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.5rem" }}>
        Verify Internship Completion
      </h3>
      <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Interns are shown if tasks are fully verified AND payment is done. Incomplete items shown in red.
      </p>
      <div style={{ marginBottom: "1rem" }}>
        <input type="text" placeholder="Search by name, ID, or email..." value={verifySearch} onChange={(e) => setVerifySearch(e.target.value)} style={{ border: "2px solid #000", padding: "0.45rem 0.75rem", fontSize: "0.88rem", fontFamily: "inherit", outline: "none", width: "300px" }} />
      </div>
      {pendingComplete.filter((e) => {
        if (!verifySearch.trim()) return true;
        const q = verifySearch.trim().toLowerCase();
        return (e.name || "").toLowerCase().includes(q) || (e.internId || e.id || "").toLowerCase().includes(q) || (e.email || "").toLowerCase().includes(q);
      }).length === 0 ? <EmptyBox msg="No interns match criteria." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {pendingComplete.filter((e) => {
            if (!verifySearch.trim()) return true;
            const q = verifySearch.trim().toLowerCase();
            return (e.name || "").toLowerCase().includes(q) || (e.internId || e.id || "").toLowerCase().includes(q) || (e.email || "").toLowerCase().includes(q);
          }).map((enrollment) => {
            const check = isCompletionReady(enrollment);
            const rejected = !!enrollment.completionRejectedAt;
            const projects = getProjectsForEnrollment(enrollment);
            const subs = getSubmissions(enrollment);
            const verifiedCount = projects.filter((_, i) => subs[i]?.verified).length;
            const isPaid = enrollment.paymentTiming === "both" ? enrollment.paymentStage === "fully_paid" : enrollment.paymentStatus === "paid";
            return (
              <div key={enrollment.id} style={{ border: `2px solid ${check.ready ? "#34A853" : "#EA4335"}`, padding: "1.25rem", background: check.ready ? "#f0fdf4" : "#fff5f5" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div style={{ flex: 1, minWidth: "250px" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#888", marginBottom: "0.15rem" }}>{enrollment.internId || enrollment.id}</div>
                    <div style={{ fontWeight: 900, fontSize: "1.1rem" }}>{enrollment.name}</div>
                    <div style={{ fontSize: "0.82rem", color: "#555", marginTop: "0.25rem" }}>{enrollment.email} | {enrollment.domain} | {enrollment.college || "-"}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end", minWidth: "180px" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, padding: "0.25rem 0.5rem", border: `2px solid ${check.ready ? "#34A853" : "#EA4335"}`, background: check.ready ? "#E8F5E9" : "#FFEBEE" }}>
                      {check.ready ? "✓ READY TO COMPLETE" : "✗ " + check.reason}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#555" }}>
                      Tasks: <strong>{verifiedCount}/{projects.length}</strong> verified | Payment: <strong style={{ color: isPaid ? "#34A853" : "#EA4335" }}>{isPaid ? "Paid" : (enrollment.paymentStage === "start_paid" ? "Partial" : "Not Paid")}</strong>{enrollment.paymentAmount ? <span> (₹{enrollment.paymentAmount})</span> : null} | Certificate: <strong style={{ color: enrollment.allowedCertificate === "yes" ? "#34A853" : "#999" }}>{enrollment.allowedCertificate === "yes" ? "UNLOCKED" : "Locked"}</strong>
                    </div>
                    {enrollment.transactionId && (
                      <div style={{ border: "2px solid #000", background: "#fff", padding: "0.25rem 0.5rem", fontSize: "0.72rem" }}>
                        <strong>Txn:</strong> <code>{enrollment.transactionId}</code>
                      </div>
                    )}
                    {enrollment.completionRejectedAt && (
                      <div style={{ border: "2px solid #EA4335", background: "#fff5f5", padding: "0.3rem 0.5rem", fontSize: "0.72rem", color: "#EA4335" }}>
                        <strong>Rejected:</strong> {enrollment.completionRejectReason || "No reason"}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                  {check.ready && (
                    <button className="btn-sharp" disabled={completing[enrollment.id]} style={{ padding: "0.5rem 1.5rem", background: "#34A853", borderColor: "#34A853", color: "#fff" }}
                      onClick={async () => {
                        setCompleting((p) => ({ ...p, [enrollment.id]: true }));
                        try {
                          if (rejected) await clearCompletionRejection(enrollment.id);
                          await markEnrollmentComplete(enrollment.id);
                          await loadData();
                          setSuccessMsg(`${enrollment.name} marked as Completed!`);
                          setTimeout(() => setSuccessMsg(""), 3000);
                        } catch (err) { setError("Failed: " + err.message); }
                        finally { setCompleting((p) => ({ ...p, [enrollment.id]: false })); }
                      }}
                    >{completing[enrollment.id] ? "Marking…" : "Mark Completed"}</button>
                  )}
                  {!check.ready && overrideCompleteEnrollment && (
                    <button className="btn-sharp" disabled={overrideLoading[enrollment.id]} style={{ padding: "0.5rem 1.5rem", background: "#9334E6", borderColor: "#9334E6", color: "#fff" }}
                      onClick={async () => {
                        if (!window.confirm(`Override-complete ${enrollment.name} regardless of task/payment status?`)) return;
                        setOverrideLoading((p) => ({ ...p, [enrollment.id]: true }));
                        try {
                          await overrideCompleteEnrollment(enrollment.id, "admin");
                          await loadData();
                          setSuccessMsg(`${enrollment.name} override-completed!`);
                          setTimeout(() => setSuccessMsg(""), 3000);
                        } catch (err) { setError("Failed: " + err.message); }
                        finally { setOverrideLoading((p) => ({ ...p, [enrollment.id]: false })); }
                      }}
                    >{overrideLoading[enrollment.id] ? "…" : "Override Complete"}</button>
                  )}
                  {check.ready && !rejected && (
                    <>
                      <input type="text" placeholder="Optional rejection reason…" value={rejectTexts[enrollment.id] || ""} onChange={(e) => setRejectTexts((p) => ({ ...p, [enrollment.id]: e.target.value }))}
                        style={{ ...s, flex: 1, minWidth: "200px", maxWidth: "350px", fontSize: "0.82rem" }} />
                      <button className="btn-sharp-outline" disabled={rejecting[enrollment.id]} style={{ borderColor: "#EA4335", color: "#EA4335", padding: "0.5rem 1.2rem" }}
                        onClick={async () => {
                          setRejecting((p) => ({ ...p, [enrollment.id]: true }));
                          try {
                            await rejectEnrollmentCompletion(enrollment.id, rejectTexts[enrollment.id] || "");
                            await loadData();
                            setSuccessMsg(`Completion rejected for ${enrollment.name}.`);
                            setTimeout(() => setSuccessMsg(""), 3000);
                          } catch (err) { setError("Failed: " + err.message); }
                          finally { setRejecting((p) => ({ ...p, [enrollment.id]: false })); }
                        }}
                      >{rejecting[enrollment.id] ? "Rejecting…" : "Reject"}</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatCell(value) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "object") {
    if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
    return Array.isArray(value) ? value.join(", ") : JSON.stringify(value);
  }
  return String(value);
}
