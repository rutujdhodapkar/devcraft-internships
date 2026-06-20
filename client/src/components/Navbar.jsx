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
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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
    } catch (err) {
      setVerifyError("Error checking verification ID. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .nav-items { display: none !important; }
          .hamburger-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-floating-menu { display: none !important; }
        }
      `}</style>
      <nav
        className="site-nav"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          borderBottom: "2px solid var(--border-primary)",
          backgroundColor: "#fff",
        }}
      >
        <div
          className="container nav-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "70px",
          }}
        >
          <button
            onClick={onHomeClick}
            className="brand-mark-btn"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              font: "inherit",
            }}
          >
            <span
              className="brand-mark"
              style={{
                fontWeight: 900,
                fontSize: "1.4rem",
                letterSpacing: "2px",
              }}
            >
              DEV/CRAFT
            </span>
          </button>

          {/* Hamburger for mobile */}
          <button
            className="hamburger-btn"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            style={{
              display: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.5rem",
              fontSize: "1.8rem",
              lineHeight: 1,
              fontWeight: 900,
              color: "#000",
            }}
          >
            {showMobileMenu ? "✕" : "☰"}
          </button>

          <div
            className="nav-items"
            style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}
          >
            <button
              onClick={onHomeClick}
              className="nav-link nav-btn-link"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Home
            </button>

            {user && (
              <button
                onClick={onDashboardClick}
                className="nav-link nav-btn-link"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Dashboard
              </button>
            )}
            <button
              onClick={() => {
                if (onEarnClick) {
                  onEarnClick();
                } else {
                  const el = document.getElementById("earn");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className="nav-link nav-btn-link"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Earn
            </button>
            <button
              onClick={() => setShowAboutModal(true)}
              className="nav-link nav-btn-link"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              About
            </button>

            <button
              onClick={() => setShowVerifyModal(true)}
              className="btn-sharp-outline nav-verify-btn"
              style={{
                fontWeight: 700,
                padding: "0.4rem 1rem",
                fontSize: "0.85rem",
              }}
            >
              Verify Internship
            </button>

            {/* Auth area */}
            {!authLoading && (
              <>
                {user ? (
                  <div
                    className="nav-auth-user"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    {user.photoURL && (
                      <img
                        src={user.photoURL}
                        alt="avatar"
                        className="nav-avatar"
                        referrerPolicy="no-referrer"
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                    <span
                      className="nav-user-name"
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      {user.displayName?.split(" ")[0] || "Student"}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn-sharp nav-admin-btn"
                        onClick={onAdminClick}
                      >
                        Admin Panel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onShowIdCard}
                      className="btn-sharp-outline"
                      style={{
                        padding: "0.3rem 0.8rem",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                      }}
                    >
                      ID Card
                    </button>
                    <button
                      type="button"
                      className="nav-link nav-button-link nav-logout-btn"
                      onClick={onLogout}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                      }}
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-sharp nav-signin-btn"
                    onClick={onLoginClick}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontWeight: 700,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#FFF"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#FFF"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FFF"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#FFF"
                      />
                    </svg>
                    Google Login
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Floating Mobile Menu */}
        {showMobileMenu && (
          <div
            className="mobile-floating-menu"
            style={{
              position: "fixed",
              top: "70px",
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 99,
            }}
            onClick={() => setShowMobileMenu(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff",
                borderBottom: "2px solid #000",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            >
              <button
                onClick={() => { onHomeClick(); setShowMobileMenu(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.5rem", borderBottom: "1px solid #eee" }}
              >Home</button>

              {user && (
                <button
                  onClick={() => { onDashboardClick(); setShowMobileMenu(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.5rem", borderBottom: "1px solid #eee" }}
                >Dashboard</button>
              )}
              <button
                onClick={() => { onEarnClick ? onEarnClick() : document.getElementById("earn")?.scrollIntoView({ behavior: "smooth" }); setShowMobileMenu(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.5rem", borderBottom: "1px solid #eee" }}
              >Earn</button>
              <button
                onClick={() => { setShowAboutModal(true); setShowMobileMenu(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.5rem", borderBottom: "1px solid #eee" }}
              >About</button>
              <button
                onClick={() => { setShowVerifyModal(true); setShowMobileMenu(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.5rem", borderBottom: "1px solid #eee" }}
              >Verify Internship</button>

              {!authLoading && user && (
                <>
                  {isAdmin && (
                    <button
                      onClick={() => { onAdminClick(); setShowMobileMenu(false); }}
                      style={{ background: "#000", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.5rem", color: "#fff", marginTop: "0.25rem" }}
                    >Admin Panel</button>
                  )}
                  <button
                    onClick={() => { onShowIdCard(); setShowMobileMenu(false); }}
                    style={{ background: "none", border: "2px solid #000", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", textAlign: "center", padding: "0.5rem", marginTop: "0.25rem" }}
                  >ID Card</button>
                  <button
                    onClick={() => { onLogout(); setShowMobileMenu(false); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.5rem", color: "#EA4335" }}
                  >Logout</button>
                </>
              )}
              {!authLoading && !user && (
                <button
                  onClick={() => { onLoginClick(); setShowMobileMenu(false); }}
                  style={{ background: "#000", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.5rem", color: "#fff", marginTop: "0.25rem" }}
                >Google Login</button>
              )}
            </div>
          </div>
        )}
      </nav>

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
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
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
                placeholder="Enter Intern ID (DEV-CRAFT-XXXXXX) or Enrollment ID"
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
              <div style={{ border: `2px dashed ${verificationResult.allVerified ? "#34A853" : "#EA4335"}`, padding: "1.25rem", backgroundColor: "#faf8f5", fontSize: "0.9rem" }}>
                <span className="badge-sharp" style={{ backgroundColor: verificationResult.allVerified ? "#34A853" : "#EA4335", color: "#fff", marginBottom: "0.75rem", display: "inline-block" }}>
                  {verificationResult.allVerified ? "VERIFIED PROGRAM" : "INCOMPLETE PROGRAM"}
                </span>
                <div style={{ marginBottom: "0.5rem" }}><strong>Candidate Name:</strong> {verificationResult.name}</div>
                {verificationResult.internId && (<div style={{ marginBottom: "0.5rem" }}><strong>Intern ID:</strong> <code>{verificationResult.internId}</code></div>)}
                <div style={{ marginBottom: "0.5rem" }}><strong>Domain:</strong> {verificationResult.domain}</div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>Status:</strong>{" "}
                  <span style={{ fontWeight: "bold", color: verificationResult.allVerified ? "#34A853" : "#EA4335" }}>
                    {verificationResult.allVerified ? "Completed" : "Incomplete"}
                  </span>
                </div>
                <div style={{ marginBottom: "0.5rem" }}><strong>Tasks:</strong> {verificationResult.submittedCount || 0} / {verificationResult.totalTasks || 0} submitted</div>
                <div style={{ marginBottom: "0.5rem" }}><strong>Enrolled Date:</strong> {new Date(verificationResult.createdAt).toLocaleDateString()}</div>
                <div><strong>Institution:</strong> {verificationResult.college || "-"}</div>
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
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
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
