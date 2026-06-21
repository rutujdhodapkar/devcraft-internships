import React from "react";

export default function Footer({ onTandpClick }) {
  return (
    <footer
      style={{
        borderTop: "2px solid #000",
        background: "#fafafa",
      }}
    >
      <div className="container" style={{ padding: "4rem 1rem 3rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "3rem",
            marginBottom: "3rem",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "1.5rem",
                fontFamily: "Space Grotesk",
                marginBottom: "1rem",
                fontWeight: 900,
              }}
            >
              DEV/CRAFT
            </h3>
            <p style={{ maxWidth: "300px", fontSize: "0.9rem", color: "#555" }}>
              Premium 100% free virtual internships for university and college
              students. Gain verified work experience, finish structured
              projects, and get certified.
            </p>
          </div>

          <div style={{ display: "flex", gap: "4rem", flexWrap: "wrap" }}>
            <div>
              <h4
                style={{
                  fontSize: "0.9rem",
                  textTransform: "uppercase",
                  fontFamily: "Space Grotesk",
                  marginBottom: "1rem",
                  fontWeight: 800,
                }}
              >
                Domains
              </h4>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  fontSize: "0.85rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <li>
                  <a href="#domains" style={{ color: "#555" }}>
                    Python Development
                  </a>
                </li>
                <li>
                  <a href="#domains" style={{ color: "#555" }}>
                    Java Development
                  </a>
                </li>
                <li>
                  <a href="#domains" style={{ color: "#555" }}>
                    Web Development
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4
                style={{
                  fontSize: "0.9rem",
                  textTransform: "uppercase",
                  fontFamily: "Space Grotesk",
                  marginBottom: "1rem",
                  fontWeight: 800,
                }}
              >
                Offices
              </h4>
              <p style={{ fontSize: "0.85rem", color: "#555" }}>
                Digital Platform - Remote
              </p>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#555",
                  marginTop: "0.25rem",
                }}
              >
                Support:{" "}
                <a
                  href="https://contact.rutujdhodapkar.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#000",
                    textDecoration: "underline",
                    fontWeight: 700,
                  }}
                >
                  contact.rutujdhodapkar.tech
                </a>
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: "2px solid #ddd",
            paddingTop: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            fontSize: "0.8rem",
            color: "#777",
          }}
        >
          <div>
            &copy; {new Date().getFullYear()} DEV/CRAFT. All rights reserved.
          </div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <button
              onClick={onTandpClick}
              style={{
                background: "none",
                border: "none",
                color: "#777",
                fontSize: "0.8rem",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              Terms & Services
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
