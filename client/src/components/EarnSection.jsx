import React, { useEffect, useState } from "react";

const COUNTRY_NAMES = [
  "India",
  "United States",
  "United Kingdom",
  "Australia",
  "Canada",
  "Germany",
  "France",
  "Singapore",
  "UAE",
  "Nepal",
  "Bangladesh",
  "Sri Lanka",
  "Pakistan",
  "Other",
].sort();

export default function EarnSection({
  user,
  userProfile,
  onLoginClick,
  userBan,
}) {
  const [showForm, setShowForm] = useState(false);
  const [existingCode, setExistingCode] = useState(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    college: "",
    city: "",
    country: "",
    upiId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [earnDetails, setEarnDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Check if user already has a referral code
  useEffect(() => {
    if (!user) {
      setExistingCode(null);
      return;
    }
    setCheckingCode(true);
    import("../services/data").then(({ fetchSelfReferralCode }) =>
      fetchSelfReferralCode(user.uid)
        .then((code) => setExistingCode(code || null))
        .catch(() => setExistingCode(null))
        .finally(() => setCheckingCode(false)),
    );
  }, [user]);

  // Fetch admin-configured earn details
  useEffect(() => {
    setDetailsLoading(true);
    import("../services/data").then(({ fetchEarnDetails }) =>
      fetchEarnDetails()
        .then((d) => setEarnDetails(d))
        .catch(() => {})
        .finally(() => setDetailsLoading(false)),
    );
  }, []);

  const inputStyle = {
    border: "2px solid #000",
    padding: "0.6rem 0.75rem",
    width: "100%",
    boxSizing: "border-box",
    fontSize: "0.9rem",
    outline: "none",
    fontFamily: "inherit",
  };

  const handleChange = (key, value) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("Please sign in first.");
      return;
    }
    if (!formData.upiId.trim()) {
      setError("UPI ID is required to generate your referral code.");
      return;
    }
    setSubmitting(true);
    try {
      const { createSelfReferral } = await import("../services/data");
      const payload = {
        name: formData.name || user.displayName || "",
        email: formData.email || user.email || "",
        phone: formData.phone || userProfile?.phone || "",
        college: formData.college || userProfile?.college || "",
        city: formData.city || userProfile?.city || "",
        country: formData.country || userProfile?.country || "",
        upiId: formData.upiId.trim(),
      };
      const res = await createSelfReferral(payload, user.uid);
      setResult(res);
      setExistingCode(res.code);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyClick = () => {
    if (!user) {
      onLoginClick();
      return;
    }
    if (userBan && (userBan.banType === "both" || userBan.banType === "earn")) {
      alert(
        "Your account has been restricted from the Refer & Earn program." +
          (userBan.reason ? " Reason: " + userBan.reason : ""),
      );
      return;
    }
    setFormData({
      name: user.displayName || "",
      email: user.email || "",
      phone: userProfile?.phone || "",
      college: userProfile?.college || "",
      city: userProfile?.city || "",
      country: userProfile?.country || "",
      upiId: userProfile?.upiId || "",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setResult(null);
    setError("");
  };
  const shareLink = existingCode
    ? `${window.location.origin}/?ref=${existingCode}`
    : "";

  return (
    <section
      id="earn"
      className="section-padding"
      style={{
        backgroundColor: "#fff",
        borderBottom: "2px solid #000",
        padding: "5rem 0",
      }}
    >
      <div className="container" style={{ maxWidth: "800px" }}>
        <div
          className="section-heading"
          style={{ textAlign: "center", marginBottom: "3rem" }}
        >
          <span
            className="badge-sharp"
            style={{
              marginBottom: "1rem",
              backgroundColor: "#000",
              color: "#fff",
            }}
          >
            REFERRAL PROGRAM
          </span>
          <h2
            style={{
              fontSize: "2.5rem",
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Refer &amp; Earn
          </h2>
          <p
            style={{
              color: "#555",
              maxWidth: "600px",
              margin: "0.5rem auto 0",
              fontSize: "1rem",
              lineHeight: "1.6",
            }}
          >
            Share your unique referral link with friends and classmates. When
            they enroll and complete their internship, you earn cash rewards
            directly to your UPI.
          </p>
        </div>

        {/* Reward structure */}
        <div
          id="referral-rewards"
          style={{
            border: "2px solid #000",
            boxShadow: "4px 4px 0 #000",
            padding: "1.5rem",
            background: "#fff",
            marginBottom: "2rem",
          }}
        >
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 900,
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Reward Structure
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            <div
              style={{
                border: "2px solid #34A853",
                padding: "1rem",
                background: "#EBFCEF",
              }}
            >
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 900,
                  color: "#34A853",
                }}
              >
                ₹20
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  marginTop: "0.35rem",
                }}
              >
                Per referred intern who completes their internship
              </div>
            </div>
            <div
              style={{
                border: "2px solid #000",
                padding: "1rem",
                background: "#fafafa",
              }}
            >
              <div
                style={{ fontSize: "1.6rem", fontWeight: 900, color: "#000" }}
              >
                ₹1,000
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  marginTop: "0.35rem",
                }}
              >
                Bonus when 50 referred interns complete their internship
              </div>
            </div>
          </div>
          <p
            style={{
              fontSize: "0.88rem",
              color: "#444",
              marginTop: "1rem",
              lineHeight: 1.6,
            }}
          >
            Example: if 50 referred interns complete, you earn ₹20 × 50 = ₹1,000
            plus the ₹1,000 milestone bonus —{" "}
            <strong>₹2,000 total per 50 completed interns</strong>.
          </p>
          <div style={{ marginTop: "1rem", textAlign: "right" }}>
            <button
              onClick={() => setShowDetails(true)}
              style={{
                background: "none",
                border: "2px solid #000",
                padding: "0.4rem 1rem",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ℹ How It Works — Full Details
            </button>
          </div>
        </div>

        {/* Main action box */}
        <div
          style={{
            border: "2px solid #000",
            boxShadow: "6px 6px 0 #000",
            padding: "2.5rem",
            background: "#fafafa",
            textAlign: "center",
          }}
        >
          {/* Already has a code — show it directly */}
          {existingCode && !result && (
            <div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#34A853",
                  marginBottom: "0.75rem",
                }}
              >
                Your Referral Code
              </div>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 900,
                  letterSpacing: "4px",
                  background: "#000",
                  color: "#fff",
                  display: "inline-block",
                  padding: "0.5rem 1.5rem",
                  marginBottom: "1.25rem",
                }}
              >
                {existingCode}
              </div>
              <div
                style={{
                  background: "#fff",
                  border: "2px solid #000",
                  padding: "0.75rem 1rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  wordBreak: "break-all",
                  marginBottom: "1.5rem",
                  userSelect: "all",
                }}
              >
                {shareLink}
              </div>
              <button
                className="btn-sharp"
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  alert("Referral link copied!");
                }}
                style={{ padding: "0.7rem 1.5rem", fontSize: "0.9rem" }}
              >
                Copy Link
              </button>
            </div>
          )}

          {/* Just submitted — success state */}
          {result && (
            <div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 900,
                  color: "#34A853",
                  marginBottom: "1rem",
                }}
              >
                Referral Code Created!
              </div>
              <div
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 900,
                  letterSpacing: "4px",
                  background: "#000",
                  color: "#fff",
                  display: "inline-block",
                  padding: "0.5rem 1.5rem",
                  marginBottom: "1.5rem",
                }}
              >
                {result.code}
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  color: "#555",
                  marginBottom: "1rem",
                }}
              >
                Share this link with your friends:
              </div>
              <div
                style={{
                  background: "#fff",
                  border: "2px solid #000",
                  padding: "0.75rem 1rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  wordBreak: "break-all",
                  marginBottom: "1.5rem",
                  userSelect: "all",
                }}
              >
                {window.location.origin}/?ref={result.code}
              </div>
              <button
                className="btn-sharp"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/?ref=${result.code}`,
                  );
                  alert("Referral link copied!");
                }}
                style={{ padding: "0.7rem 1.5rem", fontSize: "0.9rem" }}
              >
                Copy Link
              </button>
            </div>
          )}

          {/* No code yet — intro */}
          {!existingCode && !result && !showForm && (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "1.5rem",
                  marginBottom: "2rem",
                }}
              >
                <div
                  style={{
                    border: "2px solid #000",
                    padding: "1.5rem",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontSize: "2rem", fontWeight: 900 }}>1</div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      marginTop: "0.5rem",
                    }}
                  >
                    Apply with your UPI ID
                  </div>
                </div>
                <div
                  style={{
                    border: "2px solid #000",
                    padding: "1.5rem",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontSize: "2rem", fontWeight: 900 }}>2</div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      marginTop: "0.5rem",
                    }}
                  >
                    Share your referral link
                  </div>
                </div>
                <div
                  style={{
                    border: "2px solid #000",
                    padding: "1.5rem",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontSize: "2rem", fontWeight: 900 }}>3</div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      marginTop: "0.5rem",
                    }}
                  >
                    Earn ₹20 per completion + bonuses
                  </div>
                </div>
              </div>
              {checkingCode ? (
                <div style={{ color: "#888", fontSize: "0.9rem" }}>
                  Checking your account…
                </div>
              ) : (
                <button
                  className="btn-sharp"
                  onClick={handleApplyClick}
                  style={{
                    padding: "1rem 3rem",
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                  }}
                >
                  {user ? "Apply for Refer & Earn" : "Sign In to Apply"}
                </button>
              )}
            </div>
          )}

          {/* Application form — UPI is primary, other fields only if missing */}
          {!existingCode && !result && showForm && (
            <form
              onSubmit={handleSubmit}
              style={{
                maxWidth: "460px",
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                textAlign: "left",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontWeight: 900,
                  fontSize: "1.1rem",
                  textAlign: "center",
                  textTransform: "uppercase",
                }}
              >
                Apply for Refer &amp; Earn
              </h4>

              {error && (
                <div
                  style={{
                    border: "2px solid #EA4335",
                    padding: "0.75rem",
                    color: "#EA4335",
                    fontWeight: "bold",
                    fontSize: "0.85rem",
                    background: "#FFF5F5",
                  }}
                >
                  {error}
                </div>
              )}

              {/* UPI — highlighted as the critical field */}
              <div>
                <label
                  style={{
                    fontWeight: 900,
                    fontSize: "0.82rem",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  UPI ID *{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      fontSize: "0.75rem",
                      color: "#888",
                      textTransform: "none",
                    }}
                  >
                    — required to receive payments
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="name@upi"
                  value={formData.upiId}
                  onChange={(e) => handleChange("upiId", e.target.value)}
                  style={{ ...inputStyle, border: "2px solid #34A853" }}
                  required
                />
              </div>

              {/* Only show fields not already in the user profile */}
              {!userProfile?.phone && (
                <div>
                  <label
                    style={{
                      fontWeight: 800,
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "0.3rem",
                    }}
                  >
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    placeholder="Phone with country code"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
              )}
              {!userProfile?.college && (
                <div>
                  <label
                    style={{
                      fontWeight: 800,
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "0.3rem",
                    }}
                  >
                    College / University *
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., IIT Bombay"
                    value={formData.college}
                    onChange={(e) => handleChange("college", e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
              )}
              {!userProfile?.city && (
                <div>
                  <label
                    style={{
                      fontWeight: 800,
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "0.3rem",
                    }}
                  >
                    City *
                  </label>
                  <input
                    type="text"
                    placeholder="Your city"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
              )}
              {!userProfile?.country && (
                <div>
                  <label
                    style={{
                      fontWeight: 800,
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: "0.3rem",
                    }}
                  >
                    Country *
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    style={{
                      ...inputStyle,
                      cursor: "pointer",
                      background: "#fff",
                    }}
                    required
                  >
                    <option value="">Select your country…</option>
                    {COUNTRY_NAMES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div
                style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}
              >
                <button
                  type="submit"
                  className="btn-sharp"
                  disabled={submitting}
                  style={{ flex: 1, padding: "0.8rem", fontSize: "0.95rem" }}
                >
                  {submitting ? "Submitting…" : "Apply & Generate Code"}
                </button>
                <button
                  type="button"
                  className="btn-sharp-outline"
                  onClick={resetForm}
                  style={{ padding: "0.8rem 1.5rem", fontSize: "0.95rem" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      {/* Details Modal */}
      {showDetails && (
        <div
          onClick={() => setShowDetails(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            zIndex: 2000,
            overflowY: "auto",
            padding: "2rem 1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              border: "3px solid #000",
              boxShadow: "10px 10px 0 #000",
              width: "100%",
              maxWidth: "640px",
              position: "relative",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "#000",
                color: "#fff",
                padding: "1.25rem 1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  fontSize: "1.1rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {detailsLoading
                  ? "Loading…"
                  : earnDetails?.title || "Refer & Earn — Details"}
              </div>
              <button
                onClick={() => setShowDetails(false)}
                style={{
                  background: "none",
                  border: "1.5px solid #555",
                  color: "#fff",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "1.5rem" }}>
              {earnDetails?.description && (
                <p
                  style={{
                    fontSize: "0.92rem",
                    color: "#444",
                    marginBottom: "1.5rem",
                    lineHeight: 1.6,
                  }}
                >
                  {earnDetails.description}
                </p>
              )}

              {(earnDetails?.items || []).map((item, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #e0e0e0",
                    padding: "1rem 1.25rem",
                    marginBottom: "0.85rem",
                    borderLeft: "4px solid #000",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <span
                      style={{
                        background: "#000",
                        color: "#fff",
                        fontSize: "0.68rem",
                        fontWeight: 900,
                        padding: "0.1rem 0.45rem",
                        marginRight: "0.5rem",
                      }}
                    >
                      {i + 1}
                    </span>
                    {item.title}
                  </div>
                  {item.description && (
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "#555",
                        margin: "0 0 0.4rem",
                        lineHeight: 1.5,
                      }}
                    >
                      {item.description}
                    </p>
                  )}
                  {item.links && (
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                        marginTop: "0.4rem",
                      }}
                    >
                      {item.links.split(",").map((l, li) => {
                        const t = l.trim();
                        if (!t) return null;
                        return (
                          <a
                            key={li}
                            href={t.startsWith("http") ? t : `https://${t}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: "0.8rem",
                              color: "#000",
                              fontWeight: 700,
                              textDecoration: "underline",
                            }}
                          >
                            Link {li + 1} ↗
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {(!earnDetails?.items || earnDetails.items.length === 0) &&
                !detailsLoading && (
                  <p
                    style={{
                      color: "#888",
                      textAlign: "center",
                      padding: "1rem",
                    }}
                  >
                    No details configured yet.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
