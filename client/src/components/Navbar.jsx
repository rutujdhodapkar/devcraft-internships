import React, { useState } from "react";
import { verifyInternship } from "../services/data";

export default function Navbar({
  onAdminClick,
  user,
  isAdmin,
  onLogout,
  authLoading,
  onLoginClick,
  onHomeClick,
  onDashboardClick,
  onReferralDashboardClick,
  hasReferralCode,
  onShowIdCard,
  onEarnClick,
}) {
  const [verifyId, setVerifyId] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!verifyId.trim()) return;
    setVerifyLoading(true);
    setVerifyError("");
    setVerificationResult(null);
    try {
      const res = await verifyInternship(verifyId.trim());
      if (res) {
        setVerificationResult(res);
      } else {
        setVerifyError(
          "No active internship or certificate found with this ID.",
        );
      }
    } catch {
      setVerifyError("Error checking verification ID. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const navAction = (fn) => () => {
    closeMobileMenu();
    fn?.();
  };

  const menuItems = (
    <>
      <button
        onClick={navAction(onHomeClick)}
        className="nav-link nav-btn-link"
        type="button"
      >
        Home
      </button>

      {user && (
        <button
          onClick={navAction(onDashboardClick)}
          className="nav-link nav-btn-link"
          type="button"
        >
          Dashboard
        </button>
      )}

      {user && onReferralDashboardClick && (
        <button
          onClick={navAction(onReferralDashboardClick)}
          className="nav-link nav-btn-link nav-referral-link"
          type="button"
        >
          Referral
        </button>
      )}

      <button
        onClick={navAction(() => {
          if (onEarnClick) {
            onEarnClick();
          } else {
            const el = document.getElementById("earn");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }
        })}
        className="nav-link nav-btn-link"
        type="button"
      >
        Earn
      </button>

      <button
        onClick={navAction(() => setShowAboutModal(true))}
        className="nav-link nav-btn-link"
        type="button"
      >
        About
      </button>

      <button
        onClick={navAction(() => setShowVerifyModal(true))}
        className="btn-sharp-outline nav-verify-btn"
        type="button"
      >
        Verify Internship
      </button>

      {!authLoading && (
        <>
          {user ? (
            <div className="nav-auth-user">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt="avatar"
                  className="nav-avatar"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="nav-user-name">
                {user.displayName?.split(" ")[0] || "Student"}
              </span>
              {isAdmin && (
                <button
                  type="button"
                  className="btn-sharp nav-admin-btn"
                  onClick={navAction(onAdminClick)}
                >
                  Admin Panel
                </button>
              )}
              <button
                type="button"
                onClick={navAction(onShowIdCard)}
                className="btn-sharp-outline nav-id-btn"
              >
                ID Card
              </button>
              <button
                type="button"
                className="nav-link nav-button-link nav-logout-btn"
                onClick={navAction(onLogout)}
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-sharp nav-signin-btn"
              onClick={navAction(onLoginClick)}
            >
              Google Login
            </button>
          )}
        </>
      )}
    </>
  );

  return (
    <>
      <nav className="site-nav">
        <div className="container nav-container">
          <button
            onClick={onHomeClick}
            className="brand-mark-btn"
            type="button"
          >
            <span className="brand-mark brand-mark-full">DEV/CRAFT</span>
              <span className="brand-mark brand-mark-short">D/C</span>
          </button>

          <div className="nav-items nav-items-desktop">{menuItems}</div>

          <button
            type="button"
            className="nav-mobile-toggle"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="nav-mobile-backdrop"
            aria-label="Close menu"
            onClick={closeMobileMenu}
          />
          <div className="nav-mobile-menu" role="dialog" aria-label="Navigation menu">
            <div className="nav-mobile-menu-inner">{menuItems}</div>
          </div>
        </>
      )}

      {/* Verify Internship Modal */}
      {showVerifyModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowVerifyModal(false);
            setVerificationResult(null);
            setVerifyId("");
            setVerifyError("");
          }}
        >
          <div
            className="modal-content card-sharp"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              padding: "2.5rem",
              width: "90%",
              maxWidth: "500px",
              border: "2px solid #000",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h3 style={{ fontSize: "1.4rem", margin: 0, fontWeight: 900 }}>
                Verify Internship Credential
              </h3>
              <button
                onClick={() => {
                  setShowVerifyModal(false);
                  setVerificationResult(null);
                  setVerifyId("");
                  setVerifyError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
                type="button"
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={handleVerifySubmit}
              style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}
            >
              <input
                type="text"
                className="input-sharp"
                placeholder="Enter Intern ID (dev-craft-XXXXX) or Enrollment ID"
                value={verifyId}
                onChange={(e) => setVerifyId(e.target.value)}
                style={{
                  flex: 1,
                  padding: "0.6rem 1rem",
                  border: "2px solid #000",
                  fontSize: "0.9rem",
                }}
                required
              />
              <button
                type="submit"
                className="btn-sharp"
                style={{ padding: "0.6rem 1.2rem" }}
                disabled={verifyLoading}
              >
                {verifyLoading ? "Verifying..." : "Verify"}
              </button>
            </form>

            {verifyError && (
              <div
                style={{
                  color: "#EA4335",
                  fontWeight: "bold",
                  fontSize: "0.9rem",
                  marginBottom: "1rem",
                }}
              >
                {verifyError}
              </div>
            )}

            {verificationResult && (
              <div
                style={{
                  border: "2px dashed #bda068",
                  padding: "1.25rem",
                  backgroundColor: "#faf8f5",
                  fontSize: "0.9rem",
                }}
              >
                <span
                  className="badge-sharp"
                  style={{
                    backgroundColor: "#34A853",
                    color: "#fff",
                    marginBottom: "0.75rem",
                    display: "inline-block",
                  }}
                >
                  VERIFIED PROGRAM
                </span>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>Candidate Name:</strong> {verificationResult.name}
                </div>
                {verificationResult.internId && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <strong>Intern ID:</strong>{" "}
                    <code>{verificationResult.internId}</code>
                  </div>
                )}
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>Domain:</strong> {verificationResult.domain}
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>Status:</strong>{" "}
                  <span
                    style={{
                      fontWeight: "bold",
                      color:
                        verificationResult.status === "Completed"
                          ? "#34A853"
                          : "#FBBC05",
                    }}
                  >
                    {verificationResult.status}
                  </span>
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>Enrolled Date:</strong>{" "}
                  {new Date(verificationResult.createdAt).toLocaleDateString()}
                </div>
                <div>
                  <strong>Institution:</strong>{" "}
                  {verificationResult.college || "-"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowAboutModal(false)}
        >
          <div
            className="modal-content card-sharp"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              padding: "2.5rem",
              width: "90%",
              maxWidth: "500px",
              border: "2px solid #000",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h3 style={{ fontSize: "1.4rem", margin: 0, fontWeight: 900 }}>
                About DEV/CRAFT
              </h3>
              <button
                onClick={() => setShowAboutModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
                type="button"
              >
                &times;
              </button>
            </div>
            <p
              style={{
                lineHeight: "1.6",
                fontSize: "0.95rem",
                color: "var(--text-secondary)",
              }}
            >
              DEV/CRAFT provides top-tier 100% free virtual internships for
              university and college students. Gain verified work experience,
              finish structured programming projects, and receive certified
              validation for your software engineering credentials.
            </p>
            <p
              style={{
                lineHeight: "1.6",
                fontSize: "0.95rem",
                color: "var(--text-secondary)",
                marginTop: "1rem",
              }}
            >
              Our goal is to bridge the gap between classroom theory and
              industry practice. We offer virtual self-paced learning domains
              designed by expert engineers to help students kickstart their
              programming careers.
            </p>
            <div
              style={{
                marginTop: "2rem",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn-sharp"
                onClick={() => setShowAboutModal(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
