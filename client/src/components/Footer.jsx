import React, { useEffect, useState } from "react";
import Beams from "./Beams";
import { fetchFooterSettings } from "../services/data";

export default function Footer({ onTandpClick, onPrivacyClick, onRefundClick }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchFooterSettings().then((d) => setSettings(d)).catch(() => {});
  }, []);

  const s = settings || {};
  const columns = s.columns || [];
  const contactLinks = s.contactLinks || [
    { label: "support@rutujdhodapkar.tech", href: "mailto:support@rutujdhodapkar.tech" },
    { label: "contact.rutujdhodapkar.tech", href: "https://contact.rutujdhodapkar.tech" },
    { label: "LinkedIn", href: "https://linkedin.com/company/devcraft-internship" },
  ];
  const copyright = s.copyright || `\u00A9 ${new Date().getFullYear()} DEV/CRAFT. All rights reserved.`;

  return (
    <footer style={{ borderTop: "2px solid #000", background: "#0a0a0a", position: "relative", overflow: "hidden", color: "#ccc" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.15 }}>
        <Beams beamWidth={6} beamHeight={30} beamNumber={20} lightColor="#555" speed={2.5} noiseIntensity={1.5} scale={0.08} rotation={-3} backgroundColor="#0a0a0a" beamColor="#333" />
      </div>
      <div className="container" style={{ padding: "5rem 1rem 3rem", position: "relative", zIndex: 1 }}>
        {/* Top grid */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr", gap: "3rem", marginBottom: "4rem", maxWidth: "1200px", marginLeft: "auto", marginRight: "auto" }}>
          {/* Brand column */}
          <div>
            <h3 style={{ fontSize: "1.8rem", fontFamily: "Space Grotesk, sans-serif", marginBottom: "1.25rem", fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>
              {s.brandName || "DEV/CRAFT"}
            </h3>
            <p style={{ maxWidth: "320px", fontSize: "0.9rem", color: "#999", lineHeight: "1.7", marginBottom: "1.5rem" }}>
              {s.description || "Premium 100% free virtual internships for university and college students. Gain verified work experience, finish structured projects, and get certified."}
            </p>

          </div>

          {/* Footer columns */}
          {columns.map((col, idx) => (
            <div key={idx}>
              <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", fontFamily: "Space Grotesk, sans-serif", marginBottom: "1.25rem", fontWeight: 800, color: "#fff", letterSpacing: "1.5px" }}>{col.title}</h4>
              {col.links && col.links.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {col.links.map((link, li) => (
                    <li key={li}>
                      <a href={link.href || "#"} style={{ color: "#999", textDecoration: "none", transition: "color 0.2s" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "#999"}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {col.text && <p style={{ fontSize: "0.85rem", color: "#777", lineHeight: "1.6" }}>{col.text}</p>}
            </div>
          ))}

          {/* Contact column */}
          <div>
            <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", fontFamily: "Space Grotesk, sans-serif", marginBottom: "1.25rem", fontWeight: 800, color: "#fff", letterSpacing: "1.5px" }}>Contact</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {contactLinks.map((link, idx) => (
                <a key={idx} href={link.href || "#"} target={link.href?.startsWith("http") ? "_blank" : undefined} rel={link.href?.startsWith("http") ? "noopener noreferrer" : undefined}
                  style={{ fontSize: "0.85rem", color: "#aaa", textDecoration: "none", fontWeight: 600, transition: "color 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "#aaa"}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid #333", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", fontSize: "0.78rem", color: "#666", maxWidth: "1200px", marginLeft: "auto", marginRight: "auto" }}>
          <div>{copyright}</div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <button onClick={onTandpClick} style={{ background: "none", border: "none", color: "#888", fontSize: "0.78rem", cursor: "pointer", textDecoration: "none", padding: 0, fontFamily: "inherit", transition: "color 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#888"}
            >
              Terms & Conditions
            </button>
            <button onClick={onPrivacyClick} style={{ background: "none", border: "none", color: "#888", fontSize: "0.78rem", cursor: "pointer", textDecoration: "none", padding: 0, fontFamily: "inherit", transition: "color 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#888"}
            >
              Privacy Policy
            </button>
            <button onClick={onRefundClick} style={{ background: "none", border: "none", color: "#888", fontSize: "0.78rem", cursor: "pointer", textDecoration: "none", padding: 0, fontFamily: "inherit", transition: "color 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#888"}
            >
              Refund Policy
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
