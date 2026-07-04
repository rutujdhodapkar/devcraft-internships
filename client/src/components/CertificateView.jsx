import React, { useEffect, useState } from "react";
import { fetchEnrollmentById, fetchTemplates } from "../services/data";
import { getFirebaseIdToken, auth } from "../firebase";

function fillTemplate(html, vars) {
  let result = html;
  Object.entries(vars).forEach(([k, v]) => {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v || "");
  });
  return result;
}

const FALLBACK_CERTIFICATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Certificate of Completion - {{name}}</title>
<style>
  @page { size: landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    background: #f0f0f0;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
  }
  .certificate {
    width: 842px;
    min-height: 595px;
    background: #fff;
    border: 3px solid #000;
    padding: 56px;
    position: relative;
    box-shadow: 8px 8px 0 rgba(0,0,0,0.1);
  }
  .cert-badge {
    display: inline-block;
    background: #000;
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 3px;
    padding: 6px 18px;
    text-transform: uppercase;
    margin-bottom: 24px;
  }
  h1 {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #555;
    margin-bottom: 8px;
  }
  h2 {
    font-size: 32px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin: 16px 0 32px;
  }
  .recipient {
    font-size: 36px;
    font-weight: 900;
    margin: 24px 0;
    color: #000;
  }
  .body-text {
    font-size: 15px;
    line-height: 1.7;
    color: #333;
    max-width: 600px;
    margin: 0 auto 32px;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #000;
    padding-top: 20px;
    margin-top: 40px;
    font-size: 12px;
  }
  .meta-item { text-align: center; }
  .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
  .meta-value { font-weight: 700; margin-top: 4px; }
  .cert-status {
    margin-top: 16px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 2px;
    display: inline-block;
  }
  .cert-status.completed { background: #34A853; color: #fff; }
  .cert-status.pending { background: #FBBC05; color: #5a4000; }
  .footer-text {
    margin-top: 24px;
    font-size: 10px;
    color: #999;
    text-align: center;
    letter-spacing: 0.5px;
  }
  .qr-section {
    margin-top: 20px;
    text-align: center;
  }
  .qr-section img { width: 100px; height: 100px; }
  .qr-label { font-size: 9px; color: #aaa; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .msme-id { font-size: 10px; color: #888; margin-top: 12px; text-align: center; }
  .print-btn-wrap { text-align: center; margin: 20px 0; }
  .print-btn {
    background: #000; color: #fff; border: 1px solid #000;
    padding: 12px 30px; font-size: 13px; font-weight: 600;
    letter-spacing: 0.5px; text-transform: uppercase; cursor: pointer;
  }
  .print-btn:hover { background: #fff; color: #000; }
  @media print {
    body { background: #fff; }
    .print-btn-wrap { display: none; }
    .certificate { border: none; box-shadow: none; }
  }
</style>
</head>
<body>
<div class="print-btn-wrap">
  <button class="print-btn" onclick="window.print()">Print / Save Certificate</button>
</div>
<div class="certificate">
  <div class="cert-badge">DevCraft</div>
  <h1>Virtual Internship Program</h1>
  <h2>Certificate of Completion</h2>
  <div class="recipient">{{name}}</div>
  <div class="body-text">
    for successfully completing the virtual internship in <strong>{{domain}}</strong>.
    The candidate demonstrated commitment, completed assigned project work,
    and met the program completion criteria reviewed by DevCraft.
  </div>
  <div class="cert-status">{{status}}</div>
  <div class="meta-row">
    <div class="meta-item">
      <div class="meta-label">Date of Issue</div>
      <div class="meta-value">{{date}}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Intern ID</div>
      <div class="meta-value">{{internId}}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Credential ID</div>
      <div class="meta-value">{{id}}</div>
    </div>
  </div>
  <div class="msme-id">MSME Reg. No: {{msmeId}}</div>
  <div class="qr-section">
    <img src="{{qrCodeUrl}}" alt="Verify Certificate" />
    <div class="qr-label">Scan QR to Verify</div>
  </div>
  <div class="footer-text">DevCraft &mdash; Authorized Signatory</div>
</div>
</body>
</html>`;

export default function CertificateView() {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean);
    if (parts.length < 3 || parts[0] !== "certificate") {
      setError("Invalid certificate link.");
      return;
    }
    const enrollmentId = parts[1];
    const templateName = parts.slice(2).join("-");
    let cancelled = false;

    (async () => {
      try {
        if (auth?.authStateReady) await auth.authStateReady();
        let token = await getFirebaseIdToken();
        if (!token) {
          token = sessionStorage.getItem("cert_token");
        }
        if (!token) {
          setError("Authentication required. Please log in first.");
          return;
        }

        // Fetch server-verified certificate data (gated: payment + tasks verified)
        const certRes = await fetch(`/api/certificate-data/${encodeURIComponent(enrollmentId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        });
        const certJson = await certRes.json();
        if (!certJson.success) {
          setError(certJson.message || "Certificate not available.");
          return;
        }

        const certData = certJson.data;
        if (!certData.eligible && templateName.toLowerCase().includes("certificate")) {
          setError("Certificate is not yet available. Complete all tasks and payment first.");
          return;
        }

        const [enrollment, tmplData] = await Promise.all([
          fetchEnrollmentById(enrollmentId),
          fetchTemplates(),
        ]);
        if (cancelled) return;

        const templateNameLower = templateName.toLowerCase();
        const templates = tmplData?.templates || {};
        const allKeys = Object.keys(templates).filter((k) => k !== "templateOrder");
        let templateHtml = templates[templateName];
        if (!templateHtml) {
          const matchedKey = allKeys.find(
            (k) => k.toLowerCase().replace(/\s+/g, "-") === templateName,
          );
          if (matchedKey) templateHtml = templates[matchedKey];
        }
        if (!templateHtml && templateNameLower.includes("certificate")) {
          templateHtml = FALLBACK_CERTIFICATE;
        }
        if (!templateHtml && templateNameLower.includes("offer")) {
          const offerKey = allKeys.find(
            (k) => k.toLowerCase().replace(/\s+/g, "-") === "offer-letter",
          );
          templateHtml = offerKey ? templates[offerKey] : null;
        }
        if (!templateHtml) {
          templateHtml = Object.values(templates).find((v) => v) || FALLBACK_CERTIFICATE;
        }

        // Auto-inject msmeId and qrCodeUrl sections if missing
        if (!templateHtml.includes("{{msmeId}}")) {
          templateHtml = templateHtml.replace("</body>", '  <div class="msme-id" style="font-size:10px;color:#888;margin-top:12px;text-align:center">MSME Reg. No: {{msmeId}}</div>\n</body>');
        }
        if (!templateHtml.includes("{{qrCodeUrl}}")) {
          templateHtml = templateHtml.replace("</body>", '  <div class="qr-section" style="margin-top:20px;text-align:center">\n    <img src="{{qrCodeUrl}}" alt="Verify Certificate" style="width:100px;height:100px" />\n    <div style="font-size:9px;color:#aaa;margin-top:4px;text-transform:uppercase;letter-spacing:1px">Scan QR to Verify</div>\n  </div>\n</body>');
        }

        // Fill template with server-signed data
        const vars = {
          ...enrollment,
          name: certData.name,
          domain: certData.domain,
          internId: certData.internId,
          id: certData.id,
          status: certData.status,
          completed: certData.completed,
          msmeId: certData.msmeId,
          date: certData.date,
          startDate: certData.startDate,
          endDate: certData.endDate,
          qrCodeUrl: certData.qrCodeUrl,
          _signature: certData._signature,
        };

        const filled = fillTemplate(templateHtml, vars);
        setHtml(filled);
      } catch (err) {
        if (!cancelled) setError("Failed to load certificate: " + err.message);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
        <h2 style={{ color: "#EA4335" }}>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!html) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
        <p>Loading certificate…</p>
      </div>
    );
  }

  return <iframe
    title="Certificate"
    srcDoc={html}
    style={{
      width: "100%",
      height: "100vh",
      border: "none",
      display: "block",
    }}
  />;
}