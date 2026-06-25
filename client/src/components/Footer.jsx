import React, { useEffect, useState } from "react";
import Beams from "./Beams";
import { fetchFooterSettings } from "../services/data";

export default function Footer({ onTandpClick, onPrivacyClick, onRefundClick }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchFooterSettings().then((d) => setSettings(d)).catch(() => {});
  }, []);

  const s = settings || {};
  const columns = s.columns || [
    { title: "Domains", links: [{ label: "Python Development", href: "#domains" }, { label: "Java Development", href: "#domains" }, { label: "Web Development", href: "#domains" }] },
    { title: "Offices", links: [], text: "Digital Platform - Remote" },
  ];
  const contactLinks = s.contactLinks || [
    { label: "support@rutujdhodapkar.tech", href: "mailto:support@rutujdhodapkar.tech" },
    { label: "contact.rutujdhodapkar.tech", href: "https://contact.rutujdhodapkar.tech" },
    { label: "LinkedIn", href: "https://linkedin.com/company/devcraft-internship" },
  ];
  const copyright = s.copyright || `\u00A9 ${new Date().getFullYear()} DEV/CRAFT. All rights reserved.`;

  return (
    <footer style={{ borderTop: "2px solid #000", background: "#fafafa", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.6 }}>
        <Beams beamWidth={2} beamHeight={20} beamNumber={10} lightColor="#e0e0e0" speed={1.5} noiseIntensity={1.5} scale={0.15} rotation={0} backgroundColor="#fafafa" beamColor="#e8e8e8" />
      </div>
      <div className="container" style={{ padding: "4rem 1rem 3rem", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "3rem", marginBottom: "3rem" }}>
          <div>
            <h3 style={{ fontSize: "1.5rem", fontFamily: "Space Grotesk", marginBottom: "1rem", fontWeight: 900 }}>
              {s.brandName || "DEV/CRAFT"}
            </h3>
            <p style={{ maxWidth: "300px", fontSize: "0.9rem", color: "#555" }}>
              {s.description || "Premium 100% free virtual internships for university and college students. Gain verified work experience, finish structured projects, and get certified."}
            </p>
          </div>
          <div style={{ display: "flex", gap: "4rem", flexWrap: "wrap" }}>
            {columns.map((col, idx) => (
              <div key={idx}>
                <h4 style={{ fontSize: "0.9rem", textTransform: "uppercase", fontFamily: "Space Grotesk", marginBottom: "1rem", fontWeight: 800 }}>{col.title}</h4>
                {col.links && col.links.length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {col.links.map((link, li) => (
                      <li key={li}><a href={link.href || "#"} style={{ color: "#555" }}>{link.label}</a></li>
                    ))}
                  </ul>
                )}
                {col.text && <p style={{ fontSize: "0.85rem", color: "#555" }}>{col.text}</p>}
              </div>
            ))}
            <div>
              <h4 style={{ fontSize: "0.9rem", textTransform: "uppercase", fontFamily: "Space Grotesk", marginBottom: "1rem", fontWeight: 800 }}>Contact</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {contactLinks.map((link, idx) => (
                  <a key={idx} href={link.href || "#"} target={link.href?.startsWith("http") ? "_blank" : undefined} rel={link.href?.startsWith("http") ? "noopener noreferrer" : undefined}
                    style={{ fontSize: "0.85rem", color: "#000", textDecoration: "underline", fontWeight: 700 }}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={{ borderTop: "2px solid #ddd", paddingTop: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", fontSize: "0.8rem", color: "#777" }}>
          <div>{copyright}</div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <button onClick={onTandpClick} style={{ background: "none", border: "none", color: "#777", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>Terms & Conditions</button>
            <button onClick={onPrivacyClick} style={{ background: "none", border: "none", color: "#777", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>Privacy Policy</button>
            <button onClick={onRefundClick} style={{ background: "none", border: "none", color: "#777", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>Refund Policy</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
