import React from "react";

export default function TermsAndServices({ onBackToSite }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fafafa",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          borderBottom: "2px solid #000",
          background: "#fff",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ fontSize: "1.3rem", fontFamily: "Space Grotesk", fontWeight: 900, margin: 0 }}>
          DEV/CRAFT
        </h2>
        <button
          onClick={onBackToSite}
          style={{
            background: "#000",
            color: "#fff",
            border: "none",
            padding: "0.5rem 1.2rem",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          Back to Home
        </button>
      </div>

      <div
        style={{
          maxWidth: "800px",
          width: "100%",
          margin: "0 auto",
          padding: "3rem 1.5rem 5rem",
        }}
      >
        <h1
          style={{
            fontSize: "2.2rem",
            fontFamily: "Space Grotesk",
            fontWeight: 900,
            marginBottom: "0.5rem",
          }}
        >
          Terms & Services
        </h1>
        <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "2.5rem" }}>
          Last updated: June 2026
        </p>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.75rem" }}>1. Acceptance of Terms</h2>
          <p style={{ fontSize: "0.92rem", lineHeight: "1.7", color: "#333" }}>
            By accessing or using DEV/CRAFT ("the Platform"), you agree to be bound by these Terms & Services. If you do not agree, please do not use the Platform.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.75rem" }}>2. Description of Service</h2>
          <p style={{ fontSize: "0.92rem", lineHeight: "1.7", color: "#333" }}>
            DEV/CRAFT provides free virtual internships for university and college students. Students can enroll in structured projects, complete tasks, and receive verified certificates of completion.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.75rem" }}>3. User Responsibilities</h2>
          <p style={{ fontSize: "0.92rem", lineHeight: "1.7", color: "#333" }}>
            You agree to provide accurate information during registration and enrollment. You are responsible for maintaining the confidentiality of your account credentials. Any misuse, cheating, or fraudulent activity may result in account suspension or permanent ban.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.75rem" }}>4. Intellectual Property</h2>
          <p style={{ fontSize: "0.92rem", lineHeight: "1.7", color: "#333" }}>
            All content on the Platform including project materials, branding, and curriculum are the intellectual property of DEV/CRAFT. You may not reproduce, distribute, or create derivative works without explicit permission.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.75rem" }}>5. Payments & Refunds</h2>
          <p style={{ fontSize: "0.92rem", lineHeight: "1.7", color: "#333" }}>
            While the internship itself is free, certain administrative fees may apply for certificate issuance or ID cards. All fees are non-refundable once the service has been rendered. Any disputes must be raised within 7 days of payment.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.75rem" }}>6. Limitation of Liability</h2>
          <p style={{ fontSize: "0.92rem", lineHeight: "1.7", color: "#333" }}>
            DEV/CRAFT is not liable for any indirect, incidental, or consequential damages arising from your use of the Platform. The Platform is provided "as is" without warranties of any kind.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.75rem" }}>7. Termination</h2>
          <p style={{ fontSize: "0.92rem", lineHeight: "1.7", color: "#333" }}>
            We reserve the right to suspend or terminate accounts that violate these terms or engage in abusive behavior. You may stop using the Platform at any time.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.75rem" }}>8. Changes to Terms</h2>
          <p style={{ fontSize: "0.92rem", lineHeight: "1.7", color: "#333" }}>
            We may update these terms from time to time. Continued use of the Platform after changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.75rem" }}>9. Contact</h2>
          <p style={{ fontSize: "0.92rem", lineHeight: "1.7", color: "#333" }}>
            For questions about these terms, contact us at{" "}
            <a href="https://contact.rutujdhodapkar.tech" target="_blank" rel="noopener noreferrer" style={{ color: "#000", fontWeight: 700 }}>
              contact.rutujdhodapkar.tech
            </a>.
          </p>
        </section>
      </div>

      <div
        style={{
          borderTop: "2px solid #ddd",
          padding: "1.5rem",
          textAlign: "center",
          fontSize: "0.8rem",
          color: "#777",
          marginTop: "auto",
        }}
      >
        &copy; {new Date().getFullYear()} DEV/CRAFT. All rights reserved.
      </div>
    </div>
  );
}
