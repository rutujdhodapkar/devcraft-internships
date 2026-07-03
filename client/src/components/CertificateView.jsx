import React, { useEffect, useState } from "react";
import { fetchEnrollmentById, fetchTemplates, fetchCareerPaths } from "../services/data";

function parseDuration(durationStr) {
  if (!durationStr) return 28;
  const str = String(durationStr).toLowerCase().trim();
  const num = parseInt(str, 10) || 1;
  if (str.includes("month")) return num * 30;
  if (str.includes("week")) return num * 7;
  if (str.includes("day")) return num;
  return 28;
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
  .footer-text {
    margin-top: 24px;
    font-size: 10px;
    color: #999;
    text-align: center;
    letter-spacing: 0.5px;
  }
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
  <div class="footer-text">DevCraft &mdash; Authorized Signatory</div>
</div>
</body>
</html>`;

function fillTemplate(html, vars) {
  let result = html;
  Object.entries(vars).forEach(([k, v]) => {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v || "");
  });
  return result;
}

export default function CertificateView() {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const path = window.location.pathname; // /certificate/<enrollmentId>/<templateName>
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
        const [enrollment, tmplData, cpResult] = await Promise.all([
          fetchEnrollmentById(enrollmentId),
          fetchTemplates(),
          fetchCareerPaths(),
        ]);
        if (cancelled) return;
        if (!enrollment) {
          setError("Enrollment not found.");
          return;
        }

        const templateNameLower = templateName.toLowerCase();
        const careerPaths = cpResult?.paths || [];
        const matchedPath = careerPaths.find(
          (cp) => cp.id === enrollment.domainId || cp.title === enrollment.domain
        );
        const certProjects = matchedPath?.projects?.length > 0
          ? matchedPath.projects
          : (enrollment.projects && Array.isArray(enrollment.projects) && enrollment.projects.length > 0
            ? enrollment.projects
            : []);
        const certSubs = enrollment.submissions || {};
        const certAllVerified = certProjects.length > 0 && certProjects.every((_, idx) => certSubs[idx]?.verified);
        const certUnlocked = enrollment.allowedCertificate === "yes" || ((certAllVerified || certProjects.length === 0) && (enrollment.paymentStatus === "paid" || enrollment.status === "Completed"));
        if (templateNameLower.includes("certificate") && !certUnlocked) {
          setError("Certificate is not yet available. Complete payment and task verification first.");
          return;
        }

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
        const durationDays = parseDuration(matchedPath?.duration || enrollment.duration);
        const start = new Date(enrollment.createdAt || Date.now());
        const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const startDate = start.toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        });
        const endDate = end.toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        });
        const certDate = enrollment.certificateDate ? new Date(enrollment.certificateDate) : start;
        const date = certDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const qrCodeUrl = `${window.location.origin}/api/qr/${encodeURIComponent(enrollment.id || enrollment.internId || "")}`;
        const filled = fillTemplate(templateHtml, {
          ...enrollment,
          qrCodeUrl,
          date,
          startDate,
          endDate,
          internId: enrollment.internId || enrollment.id || "",
          id: enrollment.id || enrollment.internId || "",
        });

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
