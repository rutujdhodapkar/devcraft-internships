import React, { useEffect, useState } from "react";

const fetchMap = {
  terms: "fetchTermsContent",
  privacy: "fetchPrivacyContent",
  refund: "fetchRefundContent",
};

const titleMap = {
  terms: "Terms & Conditions",
  privacy: "Privacy Policy",
  refund: "Refund Policy",
};

export default function PolicyPage({ type, onBackToSite }) {
  const [html, setHtml] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fn = fetchMap[type];
    if (!fn) return;
    setLoading(true);
    import("../services/data")
      .then((mod) => mod[fn]())
      .then((content) => setHtml(typeof content === "string" ? content : ""))
      .catch(() => setHtml(""))
      .finally(() => setLoading(false));
  }, [type]);

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", flexDirection: "column" }}>
      <div style={{ borderBottom: "2px solid #000", background: "#fff", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: "1.3rem", fontFamily: "Space Grotesk", fontWeight: 900, margin: 0 }}>DEV/CRAFT</h2>
        <button onClick={onBackToSite} style={{ background: "#000", color: "#fff", border: "none", padding: "0.5rem 1.2rem", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", textTransform: "uppercase" }}>
          Back to Home
        </button>
      </div>
      <div style={{ maxWidth: "800px", width: "100%", margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#888", padding: "3rem 0" }}>Loading…</div>
        ) : html ? (
          <div className="terms-content" dangerouslySetInnerHTML={{ __html: html }} style={{ fontSize: "0.92rem", lineHeight: "1.7", color: "#333" }} />
        ) : (
          <div style={{ textAlign: "center", color: "#aaa", padding: "3rem 0" }}>
            {titleMap[type] || "This policy"} has not been set yet. Please check back later.
          </div>
        )}
        <style>{`
          .terms-content h1 { font-size: 2rem; font-weight: 900; margin: 0 0 0.5rem; }
          .terms-content h2 { font-size: 1.3rem; font-weight: 800; margin: 2rem 0 0.75rem; }
          .terms-content h3 { font-size: 1.1rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
          .terms-content p { margin: 0 0 1rem; }
          .terms-content ul, .terms-content ol { margin: 0 0 1rem; padding-left: 1.5rem; }
          .terms-content li { margin-bottom: 0.3rem; }
          .terms-content a { color: #000; font-weight: 700; }
          .terms-content strong { font-weight: 800; }
          .terms-content blockquote { border-left: 3px solid #000; margin: 1rem 0; padding: 0.5rem 1rem; background: #f5f5f5; }
        `}</style>
      </div>
      <div style={{ borderTop: "2px solid #ddd", padding: "1.5rem", textAlign: "center", fontSize: "0.8rem", color: "#777", marginTop: "auto" }}>
        &copy; {new Date().getFullYear()} DEV/CRAFT. All rights reserved.
      </div>
    </div>
  );
}
