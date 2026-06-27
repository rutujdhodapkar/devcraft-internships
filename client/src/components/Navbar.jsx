import React, { useState } from "react";
import { verifyInternship, saveUserProfile } from "../services/data";

import GlassSurface from "./GlassSurface";
import CircularText from "./CircularText";

const DEFAULT_HEADER_SETTINGS = {
  animation: "slide-down",
  effect: "solid",
  circlesText: "",
};

export default function Navbar({
  onAdminClick,
  user,
  userProfile,
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
  headerSettings = DEFAULT_HEADER_SETTINGS,
}) {
  const anim = headerSettings?.animation ?? DEFAULT_HEADER_SETTINGS.animation;
  const effect = headerSettings?.effect ?? DEFAULT_HEADER_SETTINGS.effect;
  const isGlass = effect !== "solid";

  // Glass props per effect variant
  const glassProps = {
    "glass-subtle":    { distortionScale: -60,  blur: 8,  brightness: 70, opacity: 0.85, backgroundOpacity: 0.08, saturation: 1.2, redOffset: 0, greenOffset: 5,  blueOffset: 10 },
    "glass-distorted": { distortionScale: -180, blur: 11, brightness: 50, opacity: 0.93, backgroundOpacity: 0,    saturation: 1,   redOffset: 0, greenOffset: 10, blueOffset: 20 },
    "glass-frost":     { distortionScale: -40,  blur: 18, brightness: 80, opacity: 0.95, backgroundOpacity: 0.18, saturation: 1.4, redOffset: 0, greenOffset: 3,  blueOffset: 6  },
    "glass-chromatic": { distortionScale: -220, blur: 14, brightness: 45, opacity: 0.9,  backgroundOpacity: 0,    saturation: 1.6, redOffset: 8, greenOffset: 16, blueOffset: 28 },
  };
  const activeGlassProps = glassProps[effect] || glassProps["glass-subtle"];
  const [verifyId, setVerifyId] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

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

  const handleOpenProfileEdit = () => {
    setProfileForm({
      phone: userProfile?.phone || "",
      college: userProfile?.college || "",
      city: userProfile?.city || "",
      country: userProfile?.country || "",
      upiId: userProfile?.upiId || "",
    });
    setShowProfileModal(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await saveUserProfile(user.uid, profileForm);
      setShowProfileModal(false);
      alert("Profile updated successfully.");
    } catch (err) {
      alert("Failed to save profile: " + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes navSlideDown {
          from { opacity: 0; transform: translateY(-24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes navFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes navScaleUp {
          from { opacity: 0; transform: scaleY(0.7) scaleX(0.95); transform-origin: top center; }
          to   { opacity: 1; transform: scaleY(1) scaleX(1); }
        }
        @keyframes navBlurReveal {
          from { opacity: 0; filter: blur(12px); transform: translateY(-8px); }
          to   { opacity: 1; filter: blur(0px); transform: translateY(0); }
        }
        .site-nav--slide-down  { animation: navSlideDown  0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .site-nav--fade-in     { animation: navFadeIn      0.6s ease both; }
        .site-nav--scale-up    { animation: navScaleUp     0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .site-nav--blur-reveal { animation: navBlurReveal  0.65s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .site-nav--none        { animation: none; }
        @media (max-width: 768px) {
          .nav-glass-wrap { display: none !important; }
          .hamburger-glass { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-floating-menu { display: none !important; }
          .nav-glass-wrap { display: flex !important; align-items: center; }
          .hamburger-glass { display: none !important; }
        }
        /* Glass Navbar Panel Overrides */
        .nav-glass-panel .glass-surface__content {
          padding: 0 !important;
          justify-content: flex-start !important;
        }
        .nav-glass-panel-logo .glass-surface__content {
          padding: 0 1.25rem !important;
        }
      `}</style>
      <nav
        className={`site-nav site-nav--${anim}`}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          border: "none",
          background: "transparent",
          pointerEvents: "none",
          padding: "0.75rem 0",
        }}
      >
        <div
          className="container nav-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "60px",
            flexWrap: "nowrap",
            pointerEvents: "auto",
            gap: "1.5rem",
          }}
        >
          {isGlass ? (
            <GlassSurface
              width="auto"
              height={56}
              borderRadius={0}
              className="nav-glass-panel-logo"
              style={{ pointerEvents: "auto", minWidth: 160 }}
              {...activeGlassProps}
            >
              <button
                onClick={onHomeClick}
                className="brand-mark-btn"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 1.25rem",
                  font: "inherit",
                  display: "flex",
                  alignItems: "center",
                  height: "100%",
                  width: "100%",
                }}
              >
                <span
                  className="brand-mark"
                  style={{
                    fontWeight: 900,
                    fontSize: "1.65rem",
                    letterSpacing: "2px",
                  }}
                >
                  DEV/CRAFT
                </span>
              </button>
            </GlassSurface>
          ) : (
            <div
              style={{
                width: "auto",
                height: "56px",
                backgroundColor: "var(--bg-primary)",
                border: "2px solid var(--border-primary)",
                boxShadow: "var(--card-shadow)",
                display: "flex",
                alignItems: "center",
                padding: "0 1.25rem",
                pointerEvents: "auto",
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
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  className="brand-mark"
                  style={{
                    fontWeight: 900,
                    fontSize: "1.65rem",
                    letterSpacing: "2px",
                  }}
                >
                  DEV/CRAFT
                </span>
              </button>
            </div>
          )}

          {/* Hamburger for mobile */}
          <div className="hamburger-glass" style={{ display: "none" }}>
            {isGlass ? (
              <GlassSurface
                width={56}
                height={56}
                borderRadius={0}
                style={{ pointerEvents: "auto" }}
                {...activeGlassProps}
              >
                <button
                  className="hamburger-btn"
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.8rem",
                    lineHeight: 1,
                    fontWeight: 900,
                    color: "#000",
                  }}
                >
                  {showMobileMenu ? "✕" : "☰"}
                </button>
              </GlassSurface>
            ) : (
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  backgroundColor: "var(--bg-primary)",
                  border: "2px solid var(--border-primary)",
                  boxShadow: "var(--card-shadow)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  pointerEvents: "auto",
                }}
              >
                <button
                  className="hamburger-btn"
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.8rem",
                    lineHeight: 1,
                    fontWeight: 900,
                    color: "#000",
                  }}
                >
                  {showMobileMenu ? "✕" : "☰"}
                </button>
              </div>
            )}
          </div>

          {isGlass ? (
            <GlassSurface
              width="auto"
              height={56}
              borderRadius={0}
              className="nav-glass-wrap nav-glass-panel"
              style={{ pointerEvents: "auto" }}
              {...activeGlassProps}
            >
              <div
                className="nav-items"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1.25rem",
                  padding: "0 1rem",
                  flexWrap: "nowrap",
                  whiteSpace: "nowrap",
                }}
              >
                <button
                  onClick={onHomeClick}
                  className="nav-link nav-btn-link"
                  style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                >Home</button>
                {user && (
                  <button onClick={onDashboardClick} className="nav-link nav-btn-link" style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Dashboard</button>
                )}
                {user && (
                  <button onClick={onReferralDashboardClick} className="nav-link nav-btn-link" style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Refer & Earn</button>
                )}
                <button onClick={() => { if (onEarnClick) { onEarnClick(); } else { document.getElementById("earn")?.scrollIntoView({ behavior: "smooth" }); } }} className="nav-link nav-btn-link" style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Earn</button>
                <button onClick={() => setShowAboutModal(true)} className="nav-link nav-btn-link" style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>About</button>
                <button onClick={() => setShowVerifyModal(true)} className="btn-sharp-outline nav-verify-btn" style={{ fontWeight: 700, padding: "0.4rem 1rem", fontSize: "0.85rem" }}>Verify Internship</button>
                {!authLoading && (
                  <>
                    {user ? (
                      <div className="nav-auth-user" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "nowrap" }}>
                        {user.photoURL && (
                          <div className="avatar-wrapper" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "200px", height: "200px" }}>
                            <img src={user.photoURL} alt="avatar" className="nav-avatar" referrerPolicy="no-referrer" style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "2px solid #000", position: "absolute", zIndex: 1, top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
                            {headerSettings?.circlesText && <div style={{ position: "absolute", inset: 0 }}><CircularText text={headerSettings.circlesText} spinDuration={20} onHover="speedUp" /></div>}
                          </div>
                        )}
                        <span className="nav-user-name" style={{ fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 600, margin: "0 0.25rem" }}>{user.displayName?.split(" ")[0] || "Student"}</span>
                        {isAdmin && <button type="button" className="btn-sharp nav-admin-btn" onClick={onAdminClick} style={{ padding: "0.4rem 1rem", fontSize: "0.85rem", fontWeight: 700 }}>Admin Panel</button>}
                        <button type="button" onClick={handleOpenProfileEdit} className="btn-sharp-outline" style={{ padding: "0.4rem 1rem", fontSize: "0.85rem", fontWeight: 700 }}>Profile</button>
                        <button type="button" onClick={onShowIdCard} className="btn-sharp-outline nav-id-btn" style={{ padding: "0.4rem 1rem", fontSize: "0.85rem", fontWeight: 700 }}>ID Card</button>
                        <button type="button" className="nav-link nav-button-link nav-logout-btn" onClick={onLogout} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>Logout</button>
                      </div>
                    ) : (
                      <button type="button" className="btn-sharp nav-signin-btn" onClick={onLoginClick} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#FFF" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#FFF" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FFF" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#FFF" />
                        </svg>
                        Google Login
                      </button>
                    )}
                  </>
                )}
              </div>
            </GlassSurface>
          ) : (
            <div
              className="nav-glass-wrap"
              style={{
                width: "auto",
                height: "56px",
                backgroundColor: "var(--bg-primary)",
                border: "2px solid var(--border-primary)",
                boxShadow: "var(--card-shadow)",
                display: "flex",
                alignItems: "center",
                padding: 0,
                pointerEvents: "auto",
              }}
            >
              <div
                className="nav-items"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1.25rem",
                  padding: "0 1rem",
                  flexWrap: "nowrap",
                  whiteSpace: "nowrap",
                }}
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
                          gap: "1rem",
                          flexWrap: "nowrap",
                        }}
                      >
                        {user.photoURL && (
                          <div
                            className="avatar-wrapper"
                            style={{
                              position: "relative",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "200px",
                              height: "200px",
                            }}
                          >
                            <img
                              src={user.photoURL}
                              alt="avatar"
                              className="nav-avatar"
                              referrerPolicy="no-referrer"
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "2px solid #000",
                                position: "absolute",
                                zIndex: 1,
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%,-50%)",
                              }}
                            />
                            {headerSettings?.circlesText && <div style={{ position: "absolute", inset: 0 }}><CircularText text={headerSettings.circlesText} spinDuration={20} onHover="speedUp" /></div>}
                          </div>
                        )}
                        <span
                          className="nav-user-name"
                          style={{
                            fontSize: "0.9rem",
                            color: "var(--text-primary)",
                            fontWeight: 600,
                            margin: "0 0.25rem",
                          }}
                        >
                          {user.displayName?.split(" ")[0] || "Student"}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn-sharp nav-admin-btn"
                            onClick={onAdminClick}
                            style={{
                              padding: "0.4rem 1rem",
                              fontSize: "0.85rem",
                              fontWeight: 700,
                            }}
                          >
                            Admin Panel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleOpenProfileEdit}
                          className="btn-sharp-outline"
                          style={{
                            padding: "0.4rem 1rem",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                          }}
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          onClick={onShowIdCard}
                          className="btn-sharp-outline"
                          style={{
                            padding: "0.4rem 1rem",
                            fontSize: "0.85rem",
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
          )}
        </div>
      </nav>

      {/* Floating Mobile Menu */}
      {showMobileMenu && (
        <div
          className="mobile-floating-menu"
          style={{
            position: "fixed",
            top: "80px",
            left: "1rem",
            right: "1rem",
            bottom: "auto",
            zIndex: 1001,
          }}
          onClick={() => setShowMobileMenu(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(20px) saturate(1.8)",
              WebkitBackdropFilter: "blur(20px) saturate(1.8)",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.5)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
            >
              <button
                onClick={() => { onHomeClick(); setShowMobileMenu(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "var(--text-primary)", borderRadius: "8px" }}
              >Home</button>

              {user && (
                <button
                  onClick={() => { onDashboardClick(); setShowMobileMenu(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "var(--text-primary)", borderRadius: "8px" }}
                >Dashboard</button>
              )}
              {user && (
                <button
                  onClick={() => { onReferralDashboardClick(); setShowMobileMenu(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "var(--text-primary)", borderRadius: "8px" }}
                >Refer & Earn</button>
              )}
              <button
                onClick={() => { onEarnClick ? onEarnClick() : document.getElementById("earn")?.scrollIntoView({ behavior: "smooth" }); setShowMobileMenu(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "var(--text-primary)", borderRadius: "8px" }}
              >Earn</button>
              <button
                onClick={() => { setShowAboutModal(true); setShowMobileMenu(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "var(--text-primary)", borderRadius: "8px" }}
              >About</button>
              <button
                onClick={() => { setShowVerifyModal(true); setShowMobileMenu(false); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.75rem", borderBottom: "1px solid rgba(0,0,0,0.06)", color: "var(--text-primary)", borderRadius: "8px" }}
              >Verify Internship</button>

              {!authLoading && user && (
                <>
                  {isAdmin && (
                    <button
                      onClick={() => { onAdminClick(); setShowMobileMenu(false); }}
                      style={{ background: "#000", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.75rem", color: "#fff", marginTop: "0.25rem" }}
                    >Admin Panel</button>
                  )}
                  <button
                    onClick={() => { onShowIdCard(); setShowMobileMenu(false); }}
                    style={{ background: "none", border: "1.5px solid var(--border-primary)", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.9rem", textAlign: "center", padding: "0.5rem 0.75rem", marginTop: "0.25rem", color: "var(--text-primary)" }}
                  >ID Card</button>
                  <button
                    onClick={() => { onLogout(); setShowMobileMenu(false); }}
                    style={{ background: "none", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.75rem", color: "#EA4335" }}
                  >Logout</button>
                </>
              )}
              {!authLoading && !user && (
                <button
                  onClick={() => { onLoginClick(); setShowMobileMenu(false); }}
                  style={{ background: "#000", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "1rem", textAlign: "left", padding: "0.6rem 0.75rem", color: "#fff", marginTop: "0.25rem" }}
                >Google Login</button>
              )}
            </div>
          </div>
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

      {/* Profile Modal */}
      {showProfileModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "#fff", border: "2px solid #000", boxShadow: "8px 8px 0 #000",
            padding: "2rem", width: "420px", maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto",
          }}>
            <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.1rem", marginBottom: "1.5rem" }}>
              Edit Profile
            </h3>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "0.3rem" }}>Name</label>
              <input value={user?.displayName || ""} disabled style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", background: "#f5f5f5", borderRadius: 0, fontFamily: "inherit" }} />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "0.3rem" }}>Email</label>
              <input value={user?.email || ""} disabled style={{ width: "100%", padding: "0.5rem", border: "1px solid #ccc", background: "#f5f5f5", borderRadius: 0, fontFamily: "inherit" }} />
            </div>

            {["phone", "college", "city", "country", "upiId"].map((field) => (
              <div key={field} style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                  {field === "upiId" ? "UPI ID" : field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  value={profileForm[field] || ""}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={`Enter your ${field}`}
                  style={{ width: "100%", padding: "0.5rem", border: "2px solid #000", borderRadius: 0, fontFamily: "inherit" }}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button onClick={() => setShowProfileModal(false)} className="btn-sharp" style={{ padding: "0.5rem 1.25rem", background: "#fff", color: "#000", border: "2px solid #000", fontWeight: 700, cursor: "pointer", borderRadius: 0 }}>
                Cancel
              </button>
              <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-sharp" style={{ padding: "0.5rem 1.25rem", background: "#000", color: "#fff", border: "2px solid #000", fontWeight: 700, cursor: "pointer", borderRadius: 0 }}>
                {savingProfile ? "Saving..." : "Save"}
              </button>
            </div>
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
