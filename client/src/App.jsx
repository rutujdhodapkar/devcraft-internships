import React, { useState, useEffect, useRef } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import CareerPaths from "./components/CareerPaths";
import HowItWorks from "./components/HowItWorks";
import FAQ from "./components/FAQ";
import AuthPage from "./components/AuthPage";
import StudentDashboard from "./components/StudentDashboard";
import Footer from "./components/Footer";
import AdminPanel from "./components/AdminPanel";
import AgencyDashboard from "./components/AgencyDashboard";
import EarnSection from "./components/EarnSection";
import ReferralDashboard from "./components/ReferralDashboard";
import IDCardModal from "./components/IDCardModal";
import PopupModal from "./components/PopupModal";
import PolicyPage from "./components/PolicyPage";
import CertificateView from "./components/CertificateView";
import VerifyCertificate from "./components/VerifyCertificate";
import ErrorBoundary from "./components/ErrorBoundary";
import LogoLoopSection from "./components/LogoLoopSection";
import SlidingStrip from "./components/SlidingStrip";
import WhatDoYouGet from "./components/WhatDoYouGet";
import UniversityCollab from "./components/UniversityCollab";
import Loader from "./components/Loader";
import CustomCursor from "./components/CustomCursor";
import ErrorPage from "./components/ErrorPage";
import MessageBox from "./components/MessageBox";
import ConfirmModal from "./components/ConfirmModal";
import McpDashboard from "./components/McpDashboard";
import UniversityOrgPage from "./components/UniversityOrgPage";
import { notify } from "./services/notify";
import { getDomainIconUrl } from "./utils/domainIcons";
import { detectDialCode } from "./utils/currency";
import { confirmAction } from "./services/confirm";
import {
  processReferralFromUrl,
  checkAdminStatus,
  checkAgencyStatus,
  fetchUserProfile,
  saveUserProfile,
  enrollStudent,
  fetchUserEnrollments,
  fetchUserEnrollmentsCached,
  recordReferralLogin,
  isReferralCodeMatched,
  savePermanentReferralCode,
  fetchSelfReferralCode,
  autoAssignReferralCode,
  checkUserBan,
  fetchAdminMessages,
  associateVisitsWithUser,
  associateDeviceWithUser,
  getDeviceFingerprint,
  trackSiteVisit,
  fetchHeaderSettings,
  fetchPopupSettings,
  recordUserLogin,
  recordUserLogout,
} from "./services/data";
import {
  onGoogleAuthStateChanged,
  openGoogleLogin,
  signOutGoogle,
} from "./firebase";

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Country codes list (top 60+ countries)
const COUNTRY_CODES = [
  { code: "+91", country: "India", iso: "IN" },
  { code: "+1", country: "United States", iso: "US" },
  { code: "+44", country: "United Kingdom", iso: "GB" },
  { code: "+61", country: "Australia", iso: "AU" },
  { code: "+1", country: "Canada", iso: "CA" },
  { code: "+49", country: "Germany", iso: "DE" },
  { code: "+33", country: "France", iso: "FR" },
  { code: "+39", country: "Italy", iso: "IT" },
  { code: "+34", country: "Spain", iso: "ES" },
  { code: "+31", country: "Netherlands", iso: "NL" },
  { code: "+46", country: "Sweden", iso: "SE" },
  { code: "+47", country: "Norway", iso: "NO" },
  { code: "+45", country: "Denmark", iso: "DK" },
  { code: "+358", country: "Finland", iso: "FI" },
  { code: "+41", country: "Switzerland", iso: "CH" },
  { code: "+43", country: "Austria", iso: "AT" },
  { code: "+32", country: "Belgium", iso: "BE" },
  { code: "+351", country: "Portugal", iso: "PT" },
  { code: "+48", country: "Poland", iso: "PL" },
  { code: "+7", country: "Russia", iso: "RU" },
  { code: "+380", country: "Ukraine", iso: "UA" },
  { code: "+90", country: "Turkey", iso: "TR" },
  { code: "+966", country: "Saudi Arabia", iso: "SA" },
  { code: "+971", country: "UAE", iso: "AE" },
  { code: "+20", country: "Egypt", iso: "EG" },
  { code: "+27", country: "South Africa", iso: "ZA" },
  { code: "+234", country: "Nigeria", iso: "NG" },
  { code: "+254", country: "Kenya", iso: "KE" },
  { code: "+233", country: "Ghana", iso: "GH" },
  { code: "+92", country: "Pakistan", iso: "PK" },
  { code: "+880", country: "Bangladesh", iso: "BD" },
  { code: "+94", country: "Sri Lanka", iso: "LK" },
  { code: "+977", country: "Nepal", iso: "NP" },
  { code: "+86", country: "China", iso: "CN" },
  { code: "+81", country: "Japan", iso: "JP" },
  { code: "+82", country: "South Korea", iso: "KR" },
  { code: "+65", country: "Singapore", iso: "SG" },
  { code: "+60", country: "Malaysia", iso: "MY" },
  { code: "+66", country: "Thailand", iso: "TH" },
  { code: "+62", country: "Indonesia", iso: "ID" },
  { code: "+63", country: "Philippines", iso: "PH" },
  { code: "+84", country: "Vietnam", iso: "VN" },
  { code: "+55", country: "Brazil", iso: "BR" },
  { code: "+54", country: "Argentina", iso: "AR" },
  { code: "+57", country: "Colombia", iso: "CO" },
  { code: "+52", country: "Mexico", iso: "MX" },
  { code: "+56", country: "Chile", iso: "CL" },
  { code: "+51", country: "Peru", iso: "PE" },
  { code: "+593", country: "Ecuador", iso: "EC" },
  { code: "+64", country: "New Zealand", iso: "NZ" },
];

const COUNTRY_NAMES = COUNTRY_CODES.map((c) => c.country).sort();

/** Auto-detect country code from browser locale (synchronous fallback) */
function detectCountryCode() {
  const lang = navigator.language || navigator.userLanguage || "";
  const region = lang.includes("-") ? lang.split("-")[1].toUpperCase() : "";
  const match = COUNTRY_CODES.find((c) => c.iso === region);
  return match ? match.code : "+1";
}

export default function App() {
  const initialView = (() => {
    const path = window.location.pathname;
    if (path.startsWith("/certificate/")) return "certificate";
    if (path.startsWith("/verify/")) return "verify";
    if (path === "/admin") return "admin";
    if (path === "/agency") return "agency";
    if (path === "/tandp") return "tandp";
    if (path === "/privacy") return "privacy";
    if (path === "/refund") return "refund";
    if (path === "/earn") return "earn";
    if (path === "/mcp") return "mcp";
    if (path === "/university") return "university";
    if (path === "/") return "site";
    return "error";
  })();
  const [currentView, setCurrentView] = useState(initialView); // 'site', 'auth', 'dashboard', 'admin', 'agency', 'tandp', 'privacy', 'refund', 'certificate', 'verify', 'error'
  const [referralCode, setReferralCode] = useState("");

  // Routing Redirection Target
  const [authRedirectTarget, setAuthRedirectTarget] = useState("site");

  // Auth States
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAgency, setIsAgency] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasReferralCode, setHasReferralCode] = useState(false);

  // Profile Prompt States
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [profileForm, setProfileForm] = useState({
    countryCode: detectCountryCode(),
    phone: "",
    college: "",
    city: "",
    country: "",
    upiId: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [countrySearch, setCountrySearch] = useState("");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [referralCheckStatus, setReferralCheckStatus] = useState("idle"); // 'idle' | 'checking' | 'matched' | 'not_matched'

  // Attempt IP-based country detection on mount to improve dial code
  useEffect(() => {
    detectDialCode().then((ipCode) => {
      if (ipCode) {
        setProfileForm((prev) => ({ ...prev, countryCode: ipCode }));
      }
    });
  }, []);

  // Internship Enrollment Pipeline
  const [pendingEnrollmentDomain, setPendingEnrollmentDomain] = useState(null);
  const [applyingDomain, setApplyingDomain] = useState(null);

  // ID Card Modal
  const [showIdCard, setShowIdCard] = useState(false);
  const [idCardEnrollment, setIdCardEnrollment] = useState(null);
  const [idCardLoading, setIdCardLoading] = useState(false);

  const [showEarnModal, setShowEarnModal] = useState(false);
  const [userBan, setUserBan] = useState(null); // null | { banType, reason }
  const [adminMessages, setAdminMessages] = useState([]);
  const [dismissedMessages, setDismissedMessages] = useState(new Set());
  const [dashboardReferralTab, setDashboardReferralTab] = useState(false); // open dashboard with referral tab
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [headerSettings, setHeaderSettings] = useState({ animation: "slide-down", effect: "solid" });
  const [showPopup, setShowPopup] = useState(false);
  const [popupSettings, setPopupSettings] = useState(null);
  const [homeCourses, setHomeCourses] = useState([]);
  const [homeLayout, setHomeLayout] = useState(null);
  const [courseCategory, setCourseCategory] = useState("All");
  const [showCourseAllModal, setShowCourseAllModal] = useState(false);
  const [exploreFilter, setExploreFilter] = useState("All");

  // Console greeting
  useEffect(() => {
    console.log("%c⚠️ Complete your Tasks Legally instead of this MF", "font-size:18px; font-weight:bold; color:#ff4444; background:#000; padding:8px 12px; border-radius:4px;");
    console.log("Contacts : ceo@Fennark.xyz");
    console.log("Main Website : https://www.fennark.xyz");
    console.log("Founder : https://www.rutujdhodapkar.tech");
    console.log("More Contact : https://contact.rutujdhodapkar.tech");
  }, []);

  // Refs to avoid re-registering the auth listener on view changes
  const pendingEnrollmentRef = useRef(pendingEnrollmentDomain);
  useEffect(() => { pendingEnrollmentRef.current = pendingEnrollmentDomain; }, [pendingEnrollmentDomain]);
  const authRedirectRef = useRef(authRedirectTarget);
  useEffect(() => { authRedirectRef.current = authRedirectTarget; }, [authRedirectTarget]);
  const currentViewRef = useRef(currentView);
  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);

  // Load header settings and popup settings from DB on mount
  useEffect(() => {
    fetchPopupSettings()
      .then((d) => {
        if (d && d.enabled !== false) {
          setPopupSettings(d);
          const showWhen = d.showWhen || "on-visit";
          if (showWhen === "on-visit") {
            setShowPopup(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Show popup on login if configured
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (popupSettings?.enabled && popupSettings?.showWhen === "on-login" && user && !prevUserRef.current) {
      setShowPopup(true);
    }
    prevUserRef.current = user;
  }, [user, popupSettings]);

  // Show popup when viewing dashboard if configured
  useEffect(() => {
    if (popupSettings?.enabled && popupSettings?.showWhen === "in-dashboard" && currentView === "dashboard") {
      setShowPopup(true);
    }
  }, [currentView, popupSettings]);

  // Fetch courses and homepage layout on mount; wire cache event listeners
  useEffect(() => {
    import("./services/data").then(async ({ fetchCourses, fetchSiteConfig, fetchCareerPaths }) => {
      await Promise.all([
        fetchSiteConfig("homepageLayout").then(setHomeLayout).catch(() => {}),
        fetchCourses().then(setHomeCourses).catch(() => {}),
      ]);
      // Pre-warm career paths cache on initial load (version check is fast)
      fetchCareerPaths().catch(() => {});
    });
    // Wire re-validation on route change and tab focus
    // Refresh the version map (one cheap read) — all _versionedFetch calls
    // benefit without individual _v round-trips.
    const onTrigger = () => {
      if (document.visibilityState === "visible" || !document.hidden) {
        import("./services/data").then(({ refreshVersionMap }) => refreshVersionMap());
      }
    };
    window.addEventListener("popstate", onTrigger);
    document.addEventListener("visibilitychange", onTrigger);
    return () => {
      window.removeEventListener("popstate", onTrigger);
      document.removeEventListener("visibilitychange", onTrigger);
    };
  }, []);

  // Load header settings from DB on mount
  useEffect(() => {
    fetchHeaderSettings()
      .then((s) => { if (s) setHeaderSettings(s); })
      .catch(() => {});
  }, []);

  // Listen to Google Auth state (runs once on mount; uses refs for latest state values)
  useEffect(() => {
    const unsubscribe = onGoogleAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        // Always re-read URL on auth change so referral is checked at login
        const { code: urlCode, matched } = await processReferralFromUrl();
        const storedReferral = matched ? urlCode : "";
        if (storedReferral) {
          setReferralCode(storedReferral);
          // Save referral permanently to user's profile
          savePermanentReferralCode(currentUser.uid, storedReferral).catch(
            () => {},
          );
        }
        if (storedReferral) {
          recordReferralLogin(storedReferral, currentUser).catch((e) => {
            console.warn("Could not record referral login:", e.message);
          });
        }

        // Associate this device with the logged-in user for visit tracking
        try {
          const fp = getDeviceFingerprint();
          if (fp) {
            associateDeviceWithUser(fp, currentUser);
            associateVisitsWithUser(fp, currentUser.email, currentUser.displayName, currentUser.uid);
          }
        } catch (e) {
          console.warn("Could not associate visits:", e.message);
        }

        // Record this login for live active-users tracking
        recordUserLogin(currentUser.uid, currentUser);

        // Check if user has a self-created referral code
        fetchSelfReferralCode(currentUser.uid)
          .then((code) => {
            setHasReferralCode(!!code);
          })
          .catch(() => setHasReferralCode(false));

        // Check root admin hash
        const hash = await sha256(currentUser.email.toLowerCase());
        const isRootAdmin =
          hash ===
          "9de7c6f74278613debd72673db80f6d8d69bb7c0aae71746745d75fc5e264083";
        let isUserAdmin = isRootAdmin;

        if (!isUserAdmin) {
          try {
            const checkRes = await checkAdminStatus(currentUser.email);
            isUserAdmin = checkRes.isAdmin;
          } catch (e) {
            console.warn("Could not verify admin status:", e.message);
          }
        }
        setIsAdmin(isUserAdmin);

        // Check agency status
        try {
          const agencyRes = await checkAgencyStatus(currentUser.email);
          setIsAgency(agencyRes.isAgency);
        } catch (e) { setIsAgency(false); }

        // Check if user is banned
        try {
          const ban = await checkUserBan(currentUser.email);
          setUserBan(ban || null);
        } catch (e) { console.warn("checkUserBan:", e.message); }

        // Fetch admin messages for this user (global only — tab-specific load in dashboard)
        try {
          const msgs = await fetchAdminMessages(currentUser.email, {
            uid: currentUser.uid,
          });
          setAdminMessages(
            (msgs || []).filter((m) => !m.context || m.context === "all"),
          );
        } catch (e) { console.warn("fetchAdminMessages:", e.message); }

        // Fetch / Sync profile details from backend Firestore
        try {
          const profile = await fetchUserProfile(currentUser.uid);
          if (profile) {
            setUserProfile(profile);

            // Auto-assign referral code if user has UPI but no code yet
            if (profile.upiId) {
              autoAssignReferralCode(currentUser.uid, profile).then((code) => {
                if (code) setHasReferralCode(true);
              });
            }

            // Check if profile is complete — UPI is only required during enrollment, not plain login
            const isComplete =
              profile.phone &&
              profile.college &&
              profile.city &&
              profile.country;
            if (!isComplete) {
              const localCode = detectCountryCode();
              setProfileForm({
                countryCode: profile.countryCode || localCode,
                phone: profile.phone || "",
                college: profile.college || "",
                city: profile.city || "",
                country: profile.country || "",
                upiId: profile.upiId || "",
              });
              setShowProfilePrompt(true);
            } else {
              // Profile is complete!
              const penDomain = pendingEnrollmentRef.current;
              const curView = currentViewRef.current;
              const redirectTarget = authRedirectRef.current;
              if (penDomain) {
                const existingEnrollments = await fetchUserEnrollmentsCached(currentUser.uid, currentUser.email);
                const alreadyApplied = existingEnrollments.some(
                  (e) =>
                    e.domainId === penDomain.id ||
                    (e.domain || "").toLowerCase() ===
                      (penDomain.title || "").toLowerCase(),
                );
                if (alreadyApplied && !(await confirmAction("You have already applied to this domain. Do you want to apply again?"))) {
                  setPendingEnrollmentDomain(null);
                  setCurrentView("dashboard");
                } else {
                  try {
                    await enrollStudent(
                      currentUser.uid,
                      profile,
                      penDomain,
                    );
                  } catch (e) {
                    console.warn("Pending enrollment failed:", e);
                  }
                  setPendingEnrollmentDomain(null);
                  setDashboardRefreshKey((k) => k + 1);
                  setCurrentView("dashboard");
                }
              } else {
                try {
                  const userEnrs = await fetchUserEnrollmentsCached(currentUser.uid, currentUser.email);
                  if (
                    curView !== "admin" &&
                    curView !== "site" &&
                    curView !== "tandp" &&
                    curView !== "certificate" &&
                    curView !== "verify" &&
                    userEnrs.length > 0
                  ) {
                    setCurrentView("dashboard");
                  } else if (curView === "auth") {
                    setCurrentView(
                      isUserAdmin ? "admin" : redirectTarget,
                    );
                  }
                } catch (e) {
                  console.warn(
                    "Error fetching user enrollments on auth change:",
                    e,
                  );
                  if (curView === "auth") {
                    setCurrentView(
                      isUserAdmin ? "admin" : redirectTarget,
                    );
                  }
                }
              }
            }
          } else {
            // Profile does not exist yet
            const localCode = detectCountryCode();
            setProfileForm({
              countryCode: localCode,
              phone: "",
              college: "",
              city: "",
              country: "",
              upiId: "",
            });
            setShowProfilePrompt(true);
          }
        } catch (err) {
          console.error("Profile fetch failed:", err);
        }
      } else {
        setIsAdmin(false);
        setUserProfile(null);
        setHasReferralCode(false);
        setUserBan(null);
        setAdminMessages([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync URL with current view for deep-linking
  useEffect(() => {
    if (currentView === "certificate" || currentView === "verify") return;
    const map = { tandp: "/tandp", privacy: "/privacy", refund: "/refund", earn: "/earn", mcp: "/mcp", university: "/university", skiper: "/skiper" };
    const targetPath = map[currentView] || "/";
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
  }, [currentView]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePop = () => {
      const path = window.location.pathname;
      if (path.startsWith("/certificate/")) setCurrentView("certificate");
      else if (path.startsWith("/verify/")) setCurrentView("verify");
      else if (path === "/admin") setCurrentView("admin");
      else if (path === "/tandp") setCurrentView("tandp");
      else if (path === "/privacy") setCurrentView("privacy");
      else if (path === "/refund") setCurrentView("refund");
      else if (path === "/earn") setCurrentView("earn");
      else if (path === "/mcp") setCurrentView("mcp");
      else       if (path === "/university") setCurrentView("university");
      else if (["tandp", "privacy", "refund", "certificate", "earn", "mcp", "university", "verify"].includes(currentView)) setCurrentView("site");
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [currentView]);

  // Close country dropdown on outside click
  useEffect(() => {
    if (!countryDropdownOpen) return;
    const handler = (e) => {
      if (!e.target.closest('[data-country-dropdown]')) setCountryDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [countryDropdownOpen]);

  // Reset referral input when profile prompt opens
  useEffect(() => {
    if (showProfilePrompt) {
      setReferralCodeInput("");
      setReferralCheckStatus("idle");
    }
  }, [showProfilePrompt]);

  // Referral tracking — read ref from URL, count visit if matched, persist code for intern enrollment
  useEffect(() => {
    processReferralFromUrl()
      .then(({ code, matched }) => {
        if (matched && code) {
          setReferralCode(code);
        } else {
          setReferralCode("");
        }
      })
      .catch((error) => {
        console.warn("Referral processing failed:", error.message);
      });
    // General site visit tracking (once per session)
    trackSiteVisit().catch(() => {});
  }, []);

  const handleApplyDomain = async (domainObj) => {
    if (!user) {
      setPendingEnrollmentDomain(domainObj);
      setAuthRedirectTarget("dashboard");
      setCurrentView("auth");
      return;
    }

    // Block if banned from internship
    if (
      userBan &&
      (userBan.banType === "both" || userBan.banType === "internship")
    ) {
      notify(
        "Your account has been restricted from applying to internships." +
          (userBan.reason ? " Reason: " + userBan.reason : ""),
        "error",
      );
      return;
    }

    // Ensure a minimal profile exists (don't block enrollment with a form)
    let profile = userProfile;
    if (!profile || !profile.name) {
      profile = {
        name: user.displayName || "Student",
        email: user.email || "",
        photoURL: user.photoURL || "",
        countryCode: "+91",
        phone: "",
        college: "",
        city: "",
        country: "",
        upiId: "",
      };
      try {
        await saveUserProfile(user.uid, profile);
        setUserProfile(profile);
      } catch (e) { console.warn("saveUserProfile minimal:", e.message); }
    }

    try {
      setApplyingDomain(domainObj.title || "this domain");
      setAuthLoading(true);
      const existingEnrollments = await fetchUserEnrollments(user.uid, user.email);
      const alreadyApplied = existingEnrollments.some(
        (e) =>
          e.domainId === domainObj.id ||
          (e.domain || "").toLowerCase() ===
            (domainObj.title || "").toLowerCase(),
      );
      if (alreadyApplied) {
        if (!(await confirmAction("You have already applied to this domain. Do you want to apply again?"))) {
          setCurrentView("dashboard");
          return;
        }
      }
      await enrollStudent(user.uid, profile, domainObj);
      setDashboardRefreshKey((k) => k + 1);
      setCurrentView("dashboard");
    } catch (err) {
      notify("Enrollment failed: " + err.message, "error");
    } finally {
      setAuthLoading(false);
      setApplyingDomain(null);
    }
  };

  const handleCourseEnroll = async (course) => {
    if (!user) {
      setAuthRedirectTarget("dashboard");
      setCurrentView("auth");
      return;
    }
    try {
      setAuthLoading(true);
      const { fetchUserEnrollments, courseEnroll } = await import("./services/data");
      const existing = await fetchUserEnrollments(user.uid, user.email);
      const already = existing.some(e => e.type === "course" && e.courseId === course.id);
      if (!already) await courseEnroll(course.id, { uid: user.uid, email: user.email, name: user.displayName || "Student" });
      setDashboardRefreshKey(k => k + 1);
      setCurrentView("dashboard");
    } catch (err) {
      notify("Enrollment failed: " + err.message, "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const validateProfile = () => {
    const errors = {};
    const phoneDigits = profileForm.phone.replace(/\D/g, "");
    if (!profileForm.phone.trim()) {
      errors.phone = "Phone number is required.";
    } else if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      errors.phone = "Enter a valid phone number (7–15 digits).";
    }
    if (!profileForm.college.trim() || profileForm.college.trim().length < 3) {
      errors.college = "Please enter your college/university name.";
    }
    if (!profileForm.city.trim() || profileForm.city.trim().length < 2) {
      errors.city = "Please enter a valid city name.";
    }
    if (!profileForm.country) {
      errors.country = "Please select your country.";
    }
    if (!termsAccepted) {
      errors.terms = "You must accept the Terms & Services.";
    }
    // UPI is only required when the user is applying for an internship via referral
    if (pendingEnrollmentDomain) {
      if (
        !profileForm.upiId.trim() ||
        !/^[\w.\-]+@[\w.\-]+$/.test(profileForm.upiId.trim())
      ) {
        errors.upiId = "Please enter a valid UPI ID (e.g. name@upi).";
      }
    }
    return errors;
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const errors = validateProfile();
    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }
    setProfileErrors({});
    setProfileSaving(true);

    try {
      const fullPhone = `${profileForm.countryCode}${profileForm.phone.trim()}`;
      const updatedProfile = {
        name: user.displayName || "Student",
        email: user.email || "",
        photoURL: user.photoURL || "",
        countryCode: profileForm.countryCode,
        phone: fullPhone,
        college: profileForm.college.trim(),
        city: profileForm.city.trim(),
        country: profileForm.country,
        upiId: profileForm.upiId.trim(),
      };
      // Store referral code in localStorage if matched (enrollStudent will read & clear it)
      if (referralCheckStatus === "matched" && referralCodeInput.trim()) {
        localStorage.setItem(
          "detected_referral_code",
          referralCodeInput.trim().toUpperCase(),
        );
      }

      await saveUserProfile(user.uid, updatedProfile);
      setUserProfile(updatedProfile);
      setShowProfilePrompt(false);

      // Auto-assign referral code if user just added UPI
      if (updatedProfile.upiId) {
        autoAssignReferralCode(user.uid, updatedProfile).then((code) => {
          if (code) setHasReferralCode(true);
        });
      }

      // Execute pending enrollment if exists
      if (pendingEnrollmentDomain) {
        const existingEnrollments = await fetchUserEnrollments(user.uid, user.email);
        const alreadyApplied = existingEnrollments.some(
          (e) =>
            e.domainId === pendingEnrollmentDomain.id ||
            (e.domain || "").toLowerCase() ===
              (pendingEnrollmentDomain.title || "").toLowerCase(),
        );
        if (alreadyApplied && !(await confirmAction("You have already applied to this domain. Do you want to apply again?"))) {
          setPendingEnrollmentDomain(null);
          setCurrentView("dashboard");
          return;
        }
        await enrollStudent(user.uid, updatedProfile, pendingEnrollmentDomain);
        setPendingEnrollmentDomain(null);
        setDashboardRefreshKey((k) => k + 1);
        setCurrentView("dashboard");
      } else if (currentView === "auth") {
        setCurrentView(isAdmin ? "admin" : authRedirectTarget);
      }
    } catch (err) {
      notify("Failed to save profile: " + err.message, "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLoginClick = async () => {
    try {
      setAuthLoading(true);
      await openGoogleLogin();
    } catch (err) {
      notify("Google Sign In failed: " + (err.message || "Please try again."), "error");
      setAuthRedirectTarget("site");
      setCurrentView("auth");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleShowIdCard = async () => {
    if (!user) return;
    setIdCardLoading(true);
    try {
      const enrollments = await fetchUserEnrollments(user.uid, user.email);
      const activeEnrollment =
        enrollments.find((e) => e.status !== "Archived") || enrollments[0];
      setIdCardEnrollment(activeEnrollment || null);
      setShowIdCard(true);
    } catch {
      setIdCardEnrollment(null);
      setShowIdCard(true);
    } finally {
      setIdCardLoading(false);
    }
  };

  const handleLogout = async () => {
    if (user) recordUserLogout(user.uid);
    signOutGoogle();
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setIsAgency(false);
    setHasReferralCode(false);
    setCurrentView("site");
  };

  const renderPartnerHeader = () => <Navbar
    onAdminClick={() => setCurrentView("admin")} user={user} userProfile={userProfile} isAdmin={isAdmin} isAgency={isAgency}
    onAgencyClick={() => setCurrentView("agency")} onLogout={handleLogout} authLoading={authLoading} onLoginClick={handleLoginClick}
    onHomeClick={() => setCurrentView("site")} onDashboardClick={() => setCurrentView("dashboard")}
    onReferralDashboardClick={() => setCurrentView("dashboard")} hasReferralCode={hasReferralCode} onShowIdCard={handleShowIdCard}
    onEarnClick={() => setShowEarnModal(true)} onMcpApiClick={() => setCurrentView("mcp")} onUniOrgClick={() => setCurrentView("university")}
    isHomePage={false} headerSettings={headerSettings}
  />;

  const renderCurrentView = () => {
    switch (currentView) {
      case "admin":
        return (
          <AdminPanel
            onClose={() => setCurrentView("site")}
            user={user}
            onLogout={handleLogout}
          />
        );
      case "agency":
        return <AgencyDashboard user={user} onClose={() => setCurrentView("site")} />;
      case "auth":
        return (
          <AuthPage
            onAuthSuccess={() => {}}
            onBackToSite={() => setCurrentView("site")}
          />
        );

      case "dashboard":
        return (
          <div style={{ backgroundColor: "#f8f8f8", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <Navbar
              onAdminClick={() => setCurrentView("admin")}
              user={user}
              userProfile={userProfile}
              isAdmin={isAdmin}
              isAgency={isAgency}
              onAgencyClick={() => setCurrentView("agency")}
              onLogout={handleLogout}
              authLoading={authLoading}
              onLoginClick={handleLoginClick}
              onHomeClick={() => setCurrentView("site")}
              onDashboardClick={() => setCurrentView("dashboard")}
              onReferralDashboardClick={() => {
                setDashboardReferralTab(true);
                setCurrentView("dashboard");
              }}
              hasReferralCode={hasReferralCode}
              onShowIdCard={handleShowIdCard}
              onEarnClick={() => setShowEarnModal(true)}
              onMcpApiClick={() => setCurrentView("mcp")}
              onUniOrgClick={() => setCurrentView("university")}
              isHomePage={false}
              headerSettings={headerSettings}
            />
            <StudentDashboard
              user={user}
              userProfile={userProfile}
              initialReferralTab={dashboardReferralTab}
              onReferralTabConsumed={() => setDashboardReferralTab(false)}
              onExploreClick={() => {
                setCurrentView("site");
                setTimeout(() => {
                  document
                    .getElementById("domains")
                    ?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              dashboardRefreshKey={dashboardRefreshKey}
            />
            <Footer onTandpClick={() => setCurrentView("tandp")} onPrivacyClick={() => setCurrentView("privacy")} onRefundClick={() => setCurrentView("refund")} />
          </div>
        );
      case "referralDashboard":
        return (
          <div style={{ backgroundColor: "#f8f8f8", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <Navbar
              onAdminClick={() => setCurrentView("admin")}
              user={user}
              userProfile={userProfile}
              isAdmin={isAdmin}
              isAgency={isAgency}
              onAgencyClick={() => setCurrentView("agency")}
              onLogout={handleLogout}
              authLoading={authLoading}
              onLoginClick={handleLoginClick}
              onHomeClick={() => setCurrentView("site")}
              onDashboardClick={() => setCurrentView("dashboard")}
              onReferralDashboardClick={() => {
                setDashboardReferralTab(true);
                setCurrentView("dashboard");
              }}
              hasReferralCode={hasReferralCode}
              onShowIdCard={handleShowIdCard}
              onEarnClick={() => setShowEarnModal(true)}
              onMcpApiClick={() => setCurrentView("mcp")}
              onUniOrgClick={() => setCurrentView("university")}
              isHomePage={false}
              headerSettings={headerSettings}
            />
            <StudentDashboard
              user={user}
              userProfile={userProfile}
              initialReferralTab={dashboardReferralTab}
              onReferralTabConsumed={() => setDashboardReferralTab(false)}
              onExploreClick={() => {
                setCurrentView("site");
                setTimeout(() => {
                  document
                    .getElementById("domains")
                    ?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              dashboardRefreshKey={dashboardRefreshKey}
            />
            <Footer onTandpClick={() => setCurrentView("tandp")} onPrivacyClick={() => setCurrentView("privacy")} onRefundClick={() => setCurrentView("refund")} />
          </div>
        );

      case "earn":
        return (
          <ReferralDashboard
            user={user}
            userProfile={userProfile}
            standalone={true}
            onBackClick={() => setCurrentView("site")}
          />
        );
      case "mcp":
        return <><div style={{ minHeight: "100vh", background: "#fafafa" }}>{renderPartnerHeader()}<McpDashboard onClose={() => setCurrentView("site")} isAdmin={isAdmin} user={user} /></div><Footer onTandpClick={() => setCurrentView("tandp")} onPrivacyClick={() => setCurrentView("privacy")} onRefundClick={() => setCurrentView("refund")} /></>;
      case "university":
        return <><div style={{ minHeight: "100vh", background: "#fafafa" }}>{renderPartnerHeader()}<UniversityOrgPage onClose={() => setCurrentView("site")} isAdmin={isAdmin} user={user} /></div><Footer onTandpClick={() => setCurrentView("tandp")} onPrivacyClick={() => setCurrentView("privacy")} onRefundClick={() => setCurrentView("refund")} /></>;
      case "tandp":
        return (
          <PolicyPage
            type="terms"
            onBackToSite={() => setCurrentView("site")}
          />
        );
      case "privacy":
        return (
          <PolicyPage
            type="privacy"
            onBackToSite={() => setCurrentView("site")}
          />
        );
      case "refund":
        return (
          <PolicyPage
            type="refund"
            onBackToSite={() => setCurrentView("site")}
          />
        );
      case "certificate":
        return <CertificateView />;
      case "verify":
        return <VerifyCertificate />;
      case "error":
        return <ErrorPage />;
      case "site":
      default:
        return (
          <>
            <Navbar
              onAdminClick={() => setCurrentView("admin")}
              user={user}
              userProfile={userProfile}
              isAdmin={isAdmin}
              isAgency={isAgency}
              onAgencyClick={() => setCurrentView("agency")}
              onLogout={handleLogout}
              authLoading={authLoading}
              onLoginClick={handleLoginClick}
              onHomeClick={() => setCurrentView("site")}
              onDashboardClick={() => setCurrentView("dashboard")}
              onReferralDashboardClick={() => {
                if (user) {
                  setDashboardReferralTab(true);
                  setCurrentView("dashboard");
                } else {
                  onLoginClick();
                }
              }}
              hasReferralCode={hasReferralCode}
              onShowIdCard={handleShowIdCard}
              onEarnClick={() => {
                const el = document.getElementById("earn");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              onMcpApiClick={() => setCurrentView("mcp")}
              onUniOrgClick={() => setCurrentView("university")}
              isHomePage={true}
              headerSettings={headerSettings}
            />
            <Hero
              onApplyClick={() => {
                const el = document.getElementById("domains");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              onExploreClick={() => {
                const el = document.getElementById("domains");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            />
            <SlidingStrip />
            <LogoLoopSection />
            <CareerPaths onApplyDomain={handleApplyDomain} maxItems={homeLayout?.internshipCount || null} />
            {applyingDomain && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                <div style={{ background: "#fff", border: "3px solid #000", boxShadow: "8px 8px 0 #000", padding: "2rem 3rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.5rem" }}>Applying...</div>
                  <div style={{ fontSize: "0.95rem", color: "#555" }}>Please wait while we process your application for <strong>{applyingDomain}</strong></div>
                </div>
              </div>
            )}
            {homeLayout?.showCourses !== false && homeCourses.length > 0 && (() => {
              const count = homeLayout?.courseCount || 3;
              const visibleCats = homeLayout?.visibleCourseCategories;
              const homepageCourses = visibleCats?.length ? homeCourses.filter(c => visibleCats.includes(c.category)) : homeCourses;
              const exploreCourses = visibleCats?.length ? homeCourses.filter(c => !visibleCats.includes(c.category)) : [];
              const categories = visibleCats?.length ? visibleCats : [...new Set(homeCourses.map(c => c.category).filter(Boolean))];
              const catFilter = courseCategory === "All" ? homepageCourses : homepageCourses.filter(c => c.category === courseCategory);
              const shown = catFilter.slice(0, count);
              return (
                <div style={{ maxWidth: 1200, margin: "0 auto", padding: "3rem 1rem", fontFamily: "system-ui, sans-serif" }}>
                  <h2 style={{ fontSize: "1.75rem", fontWeight: 900, textTransform: "uppercase", textAlign: "center", margin: "0 0 0.25rem" }}>Courses</h2>
                  <p style={{ textAlign: "center", color: "#666", fontSize: "0.95rem", marginBottom: "2rem" }}>Structured programs with certificates</p>
                  {categories.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
                      {["All", ...categories].map(cat => (
                        <button key={cat} onClick={() => setCourseCategory(cat)} style={{ background: courseCategory === cat ? "#000" : "transparent", color: courseCategory === cat ? "#fff" : "#000", border: "2px solid #000", padding: "0.4rem 1rem", fontWeight: 700, cursor: "pointer", fontSize: "0.8rem", textTransform: "uppercase" }}>{cat}</button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
                    {shown.map(c => {
                      const free = c.price === 0 || !c.price;
                      return (
                        <div key={c.id} style={{ border: "2px solid #000", padding: "1.5rem", background: free ? "#fafafa" : "#fffde7", display: "flex", flexDirection: "column" }}>
                          <span style={{ display: "inline-block", background: free ? "#4caf50" : "#f9a825", color: "#fff", fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.6rem", textTransform: "uppercase", marginBottom: "0.75rem", alignSelf: "flex-start" }}>{free ? "Free" : "₹199"}</span>
                          <img src={getDomainIconUrl(c)} alt="" width="52" height="52" style={{ width: "52px", height: "52px", objectFit: "contain", marginBottom: "0.5rem" }} />
                          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 0.25rem" }}>{c.title}</h3>
                          <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 0.75rem", flex: 1 }}>{c.description}</p>
                          <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.8rem", color: "#777", marginBottom: "0.75rem" }}>
                            <span>{c.duration || "Self-paced"}</span>
                            <span>{c.level || "All Levels"}</span>
                          </div>
                          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", fontSize: "0.85rem", lineHeight: 1.8 }}>
                            {(Array.isArray(c.features) ? c.features : []).slice(0, 3).map((f, i) => <li key={i} style={{ paddingLeft: "1.25rem", textIndent: "-1.25rem" }}>-- {f}</li>)}
                          </ul>
                          <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "1.25rem", fontWeight: 900 }}>{free ? "Free" : "₹199"}</span>
                            <button onClick={() => handleCourseEnroll(c)} style={{ background: "#000", color: "#fff", border: "none", padding: "0.6rem 1.25rem", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", textTransform: "uppercase" }}>Enroll</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {exploreCourses.length > 0 && (
                    <div style={{ textAlign: "center", marginTop: "2rem" }}>
                      <button onClick={() => setShowCourseAllModal(true)} style={{ background: "#000", color: "#fff", border: "none", padding: "0.75rem 2rem", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", textTransform: "uppercase" }}>Explore More Courses</button>
                    </div>
                  )}
                </div>
              );
            })()}
            {showCourseAllModal && (
              <div onClick={() => setShowCourseAllModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 2000, overflowY: "auto", padding: "2rem 1rem" }}>
                <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", border: "3px solid #000", boxShadow: "8px 8px 0 #000", width: "100%", maxWidth: "1000px", position: "relative", marginTop: "2rem" }}>
                  <div style={{ height: "6px", background: "#000" }} />
                  <button onClick={() => setShowCourseAllModal(false)} style={{ position: "absolute", top: "0.75rem", right: "0.75rem", zIndex: 10, background: "#000", border: "none", color: "#fff", width: "36px", height: "36px", cursor: "pointer", fontSize: "1.4rem", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>×</button>
                  <div style={{ padding: "2rem" }}>
                    <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.3rem", marginBottom: "1rem" }}>All Courses</h3>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "2px solid #eee" }}>
                      <button onClick={() => setExploreFilter("All")} style={{ padding: "0.4rem 1rem", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", border: exploreFilter === "All" ? "2px solid #000" : "2px solid #ddd", background: exploreFilter === "All" ? "#000" : "#fff", color: exploreFilter === "All" ? "#fff" : "#000", textTransform: "uppercase", letterSpacing: "0.5px" }}>All</button>
                      {[...new Set(homeCourses.map(c => c.category).filter(Boolean))].map(cat => (
                        <button key={cat} onClick={() => setExploreFilter(cat)} style={{ padding: "0.4rem 1rem", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", border: exploreFilter === cat ? "2px solid #000" : "2px solid #ddd", background: exploreFilter === cat ? "#000" : "#fff", color: exploreFilter === cat ? "#fff" : "#000", textTransform: "uppercase", letterSpacing: "0.5px" }}>{cat}</button>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem" }}>
                      {(exploreFilter === "All" ? homeCourses : homeCourses.filter(c => c.category === exploreFilter)).map(c => {
                        const free = c.price === 0 || !c.price;
                        return (
                          <div key={c.id} style={{ border: "2px solid #000", padding: "1.5rem", background: free ? "#fafafa" : "#fffde7", display: "flex", flexDirection: "column" }}>
                            <span style={{ display: "inline-block", background: free ? "#4caf50" : "#f9a825", color: "#fff", fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.6rem", textTransform: "uppercase", marginBottom: "0.75rem", alignSelf: "flex-start" }}>{free ? "Free" : "₹199"}</span>
                            <img src={getDomainIconUrl(c)} alt="" width="52" height="52" style={{ width: "52px", height: "52px", objectFit: "contain", marginBottom: "0.5rem" }} />
                            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 0.25rem" }}>{c.title}</h3>
                            <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 0.75rem", flex: 1 }}>{c.description}</p>
                            <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.8rem", color: "#777", marginBottom: "0.75rem" }}>
                              <span>⏱ {c.duration || "Self-paced"}</span>
                              <span>{c.level || "All Levels"}</span>
                            </div>
                            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", fontSize: "0.85rem", lineHeight: 1.8 }}>
                              {(Array.isArray(c.features) ? c.features : []).slice(0, 3).map((f, i) => <li key={i} style={{ paddingLeft: "1.25rem", textIndent: "-1.25rem" }}>✓ {f}</li>)}
                            </ul>
                            <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "1.25rem", fontWeight: 900 }}>{free ? "Free" : "₹199"}</span>
                              <button onClick={() => handleCourseEnroll(c)} style={{ background: "#000", color: "#fff", border: "none", padding: "0.6rem 1.25rem", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", textTransform: "uppercase" }}>Enroll</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <HowItWorks />
            <WhatDoYouGet />
            <FAQ />
            <UniversityCollab />
            <EarnSection
              user={user}
              userProfile={userProfile}
              onLoginClick={handleLoginClick}
              userBan={userBan}
            />
            <Footer onTandpClick={() => setCurrentView("tandp")} onPrivacyClick={() => setCurrentView("privacy")} onRefundClick={() => setCurrentView("refund")} />
          </>
        );
    }
  };

  const inputStyle = {
    border: "2px solid #000",
    padding: "0.6rem 0.75rem",
    width: "100%",
    boxSizing: "border-box",
    fontSize: "0.9rem",
    outline: "none",
    fontFamily: "inherit",
  };
  const errorStyle = {
    color: "#EA4335",
    fontSize: "0.75rem",
    marginTop: "0.25rem",
    fontWeight: 600,
  };

  return (
    <ErrorBoundary>
      <style>{`@media(min-width:769px){*,* *{cursor:none!important}}::selection{background:#000;color:#fff}@media(min-width:1024px){html{scroll-behavior:smooth}}@keyframes notifySlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      {showLoader && currentView !== "verify" && <Loader onFinish={() => setShowLoader(false)} />}
      <CustomCursor />
      {/* Admin Messages Banner */}
      {adminMessages
        .filter((m) => m.type !== "notice")
        .filter((m) => !dismissedMessages.has(m.id))
        .map((msg) => {
          const typeStyles = {
            warning: { bg: "#FFF8E1", border: "#FBBC05", color: "#7a5c00" },
            success: { bg: "#E8F5E9", border: "#34A853", color: "#1a5c2e" },
            info: { bg: "#E3F2FD", border: "#4285F4", color: "#1a3a6c" },
          };
          const ts = typeStyles[msg.type] || typeStyles.info;
          return (
            <div
              key={msg.id}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                background: ts.bg,
                borderBottom: `3px solid ${ts.border}`,
                padding: "0.65rem 1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
                fontSize: "0.88rem",
                color: ts.color,
              }}
            >
              <div style={{ flex: 1 }}>
                {msg.title && (
                  <strong style={{ marginRight: "0.5rem" }}>
                    {msg.title}:
                  </strong>
                )}
                {msg.text}
              </div>
              <button
                onClick={async () => {
                  try {
                    const { acknowledgeAdminMessage } = await import(
                      "./services/data"
                    );
                    await acknowledgeAdminMessage(msg.id, user?.uid, {
                      email: user?.email,
                      name: user?.displayName,
                    });
                  } catch {
                    /* still hide locally */
                  }
                  setDismissedMessages((prev) => new Set([...prev, msg.id]));
                }}
                style={{
                  background: "#fff",
                  border: `2px solid ${ts.border}`,
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  color: ts.color,
                  padding: "0.25rem 0.65rem",
                  textTransform: "uppercase",
                }}
              >
                Done
              </button>
            </div>
          );
        })}
      {adminMessages
        .filter((m) => m.type === "notice")
        .map((msg) => {
          const ts = { bg: "#F3E8FF", border: "#9334EA", color: "#4a1a7a" };
          return (
            <div
              key={msg.id}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                background: ts.bg,
                borderBottom: `3px solid ${ts.border}`,
                padding: "0.65rem 1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
                fontSize: "0.88rem",
                color: ts.color,
              }}
            >
              <div style={{ flex: 1 }}>
                {msg.title && (
                  <strong style={{ marginRight: "0.5rem" }}>{msg.title}:</strong>
                )}
                {msg.text}
              </div>
            </div>
          );
        })}

      {renderCurrentView()}

      {/* Collect Student Profile Details Modal */}
      {/* ID Card Modal */}
      {showIdCard && (
        <IDCardModal
          user={user}
          userProfile={userProfile}
          enrollment={idCardEnrollment}
          onClose={() => {
            setShowIdCard(false);
            setIdCardEnrollment(null);
          }}
        />
      )}

      {showEarnModal && (
        <div
          onClick={() => setShowEarnModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            zIndex: 1500,
            overflowY: "auto",
            padding: "2rem 1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "820px", position: "relative", maxHeight: "calc(100vh - 4rem)", overflowY: "auto" }}
          >
            <button
              onClick={() => setShowEarnModal(false)}
              style={{
                position: "absolute",
                top: "0.5rem",
                right: "0.5rem",
                zIndex: 10,
                background: "#000",
                border: "none",
                color: "#fff",
                width: "32px",
                height: "32px",
                cursor: "pointer",
                fontSize: "1.2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
            <EarnSection
              user={user}
              userProfile={userProfile}
              onLoginClick={handleLoginClick}
              userBan={userBan}
            />
          </div>
        </div>
      )}

      {showProfilePrompt && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1100,
          }}
        >
          <div
            className="modal-content card-sharp"
            style={{
              backgroundColor: "#fff",
              padding: "2.5rem",
              width: "90%",
              maxWidth: "500px",
              border: "3px solid #000",
              boxShadow: "8px 8px 0 #000",
              position: "relative",
              maxHeight: "92vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                height: "6px",
                background: "linear-gradient(90deg,#000 0%,#444 100%)",
                position: "sticky",
                top: "-2.5rem",
                marginBottom: "1.5rem",
                marginLeft: "-2.5rem",
                marginRight: "-2.5rem",
                marginTop: "-2.5rem",
              }}
            />

            <h3
              style={{
                fontSize: "1.4rem",
                fontWeight: 900,
                textTransform: "uppercase",
                marginBottom: "0.4rem",
              }}
            >
              Complete Your Profile
            </h3>
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                marginBottom: "1.5rem",
                lineHeight: "1.5",
              }}
            >
              We need a few details to issue your Offer Letter and set up your
              internship. This info is saved and won't be asked again.
            </p>

            <form onSubmit={handleProfileSubmit}>
              {/* Phone Number with Country Code */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    fontWeight: 800,
                    fontSize: "0.78rem",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "0.4rem",
                  }}
                >
                  Phone Number *
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select
                    value={profileForm.countryCode}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        countryCode: e.target.value,
                      })
                    }
                    style={{
                      ...inputStyle,
                      width: "auto",
                      minWidth: "110px",
                      flex: "0 0 auto",
                      cursor: "pointer",
                      background: "#fff",
                    }}
                  >
                    {COUNTRY_CODES.map((c, i) => (
                      <option key={`${c.iso}-${i}`} value={c.code}>
                        {c.code} {c.iso}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={profileForm.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d\s\-]/g, "");
                      setProfileForm({ ...profileForm, phone: val });
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
                {profileErrors.phone && (
                  <div style={errorStyle}>{profileErrors.phone}</div>
                )}
              </div>

              {/* College */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    fontWeight: 800,
                    fontSize: "0.78rem",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "0.4rem",
                  }}
                >
                  College / University *
                </label>
                <input
                  type="text"
                  placeholder="E.g., IIT Bombay"
                  value={profileForm.college}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, college: e.target.value })
                  }
                  style={inputStyle}
                />
                {profileErrors.college && (
                  <div style={errorStyle}>{profileErrors.college}</div>
                )}
              </div>

              {/* Country */}
              <div data-country-dropdown style={{ marginBottom: "1.25rem", position: "relative" }}>
                <label
                  style={{
                    fontWeight: 800,
                    fontSize: "0.78rem",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "0.4rem",
                  }}
                >
                  Country *
                </label>
                <div
                  style={{
                    ...inputStyle,
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    padding: 0,
                    overflow: "hidden",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Search your country…"
                    value={
                      countryDropdownOpen
                        ? countrySearch
                        : profileForm.country
                    }
                    onFocus={() => {
                      setCountryDropdownOpen(true);
                      setCountrySearch("");
                    }}
                    onChange={(e) => {
                      setCountrySearch(e.target.value);
                      setCountryDropdownOpen(true);
                      if (!e.target.value) {
                        setProfileForm({ ...profileForm, country: "" });
                      }
                    }}
                    style={{
                      border: "none",
                      outline: "none",
                      padding: "0.65rem 0.75rem",
                      fontSize: "0.88rem",
                      fontFamily: "inherit",
                      width: "100%",
                      boxSizing: "border-box",
                      background: "transparent",
                    }}
                  />
                  <span
                    onClick={() => {
                      setCountryDropdownOpen(!countryDropdownOpen);
                      setCountrySearch("");
                    }}
                    style={{
                      padding: "0 0.75rem",
                      fontSize: "0.7rem",
                      color: "#888",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    {countryDropdownOpen ? "▲" : "▼"}
                  </span>
                </div>
                {countryDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 1200,
                      background: "#fff",
                      border: "2px solid #000",
                      borderTop: "none",
                      maxHeight: "250px",
                      overflowY: "auto",
                      boxShadow: "4px 4px 0 rgba(0,0,0,0.1)",
                    }}
                  >
                    {COUNTRY_NAMES.filter((name) =>
                      name.toLowerCase().includes(countrySearch.toLowerCase()),
                    ).length === 0 ? (
                      <div
                        style={{
                          padding: "0.75rem",
                          color: "#888",
                          fontSize: "0.85rem",
                        }}
                      >
                        No countries match
                      </div>
                    ) : (
                      COUNTRY_NAMES.filter((name) =>
                        name.toLowerCase().includes(
                          countrySearch.toLowerCase(),
                        ),
                      ).map((name) => (
                        <div
                          key={name}
                          onClick={() => {
                            setProfileForm({ ...profileForm, country: name });
                            setCountrySearch("");
                            setCountryDropdownOpen(false);
                          }}
                          style={{
                            padding: "0.6rem 0.75rem",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                            background:
                              profileForm.country === name
                                ? "#f0f0f0"
                                : "transparent",
                            fontWeight:
                              profileForm.country === name ? 700 : 400,
                            borderBottom: "1px solid #eee",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#f5f5f5")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              profileForm.country === name
                                ? "#f0f0f0"
                                : "transparent")
                          }
                        >
                          {name}
                        </div>
                      ))
                    )}
                  </div>
                )}
                {profileErrors.country && (
                  <div style={errorStyle}>{profileErrors.country}</div>
                )}
              </div>

              {/* City */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    fontWeight: 800,
                    fontSize: "0.78rem",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "0.4rem",
                  }}
                >
                  City *
                </label>
                <input
                  type="text"
                  placeholder="E.g., Mumbai"
                  value={profileForm.city}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, city: e.target.value })
                  }
                  style={inputStyle}
                />
                {profileErrors.city && (
                  <div style={errorStyle}>{profileErrors.city}</div>
                )}
              </div>

              {/* UPI ID — only shown when applying for an internship via referral */}
              {pendingEnrollmentDomain && (
                <div style={{ marginBottom: "1.25rem" }}>
                  <label
                    style={{
                      fontWeight: 800,
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "0.4rem",
                    }}
                  >
                    UPI ID *{" "}
                    <span
                      style={{
                        fontWeight: 400,
                        color: "#888",
                        fontSize: "0.72rem",
                        textTransform: "none",
                      }}
                    >
                      (for internship payment)
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="name@upi"
                    value={profileForm.upiId}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, upiId: e.target.value })
                    }
                    style={inputStyle}
                  />
                  {profileErrors.upiId && (
                    <div style={errorStyle}>{profileErrors.upiId}</div>
                  )}
                </div>
              )}

              {/* Referral Code */}
              <div style={{ marginBottom: "2rem" }}>
                <label
                  style={{
                    fontWeight: 800,
                    fontSize: "0.78rem",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "0.4rem",
                  }}
                >
                  Referral Code (optional)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Enter referral code if you have one"
                    value={referralCodeInput}
                    onChange={async (e) => {
                      const val = e.target.value.toUpperCase();
                      setReferralCodeInput(val);
                      if (!val.trim()) {
                        setReferralCheckStatus("idle");
                        return;
                      }
                      setReferralCheckStatus("checking");
                      const matched = await isReferralCodeMatched(val);
                      setReferralCheckStatus(
                        matched ? "matched" : "not_matched",
                      );
                    }}
                    style={{
                      ...inputStyle,
                      borderColor:
                        referralCheckStatus === "matched"
                          ? "#34A853"
                          : referralCheckStatus === "not_matched"
                            ? "#EA4335"
                            : inputStyle.borderColor,
                    }}
                  />
                  <div
                    style={{
                      fontSize: "0.75rem",
                      marginTop: "0.3rem",
                      fontWeight: 700,
                    }}
                  >
                    {referralCheckStatus === "checking" && (
                      <span style={{ color: "#888" }}>Checking...</span>
                    )}
                    {referralCheckStatus === "matched" && (
                      <span style={{ color: "#34A853" }}>
                        Referral code matched! Discount QR will be applied.
                      </span>
                    )}
                    {referralCheckStatus === "not_matched" && (
                      <span style={{ color: "#EA4335" }}>
                        Referral code didn't match. Default payment will be
                        used.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Terms & Services */}
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    color: "#333",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    style={{
                      width: "18px",
                      height: "18px",
                      cursor: "pointer",
                      accentColor: "#000",
                    }}
                  />
                  <span>
                    I accept the{" "}
                    <a
                      href="/terms-and-services"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#000", fontWeight: 700, textDecoration: "underline" }}
                    >
                      Terms & Services
                    </a>
                  </span>
                </label>
                {profileErrors.terms && (
                  <div style={errorStyle}>{profileErrors.terms}</div>
                )}
              </div>

              <button
                type="submit"
                className="btn-sharp"
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  fontSize: "1rem",
                  fontWeight: "bold",
                }}
                disabled={profileSaving}
              >
                {profileSaving ? "Saving Details..." : "Save & Continue →"}
              </button>
            </form>
          </div>
        </div>
      )}

      <PopupModal
        show={showPopup}
        onClose={() => { setShowPopup(false); }}
        settings={popupSettings}
      />
      <MessageBox />
      <ConfirmModal />
    </ErrorBoundary>
  );
}
