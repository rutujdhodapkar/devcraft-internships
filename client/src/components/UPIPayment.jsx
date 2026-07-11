import React, { useState, useEffect } from "react";
import { fetchUPISettings, submitTransactionId } from "../services/data";

const QR_API = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=";

function encodeUPI(upiId, name, amount, txnRef) {
  const params = new URLSearchParams();
  params.set("pa", upiId);
  if (name) params.set("pn", name);
  if (amount) params.set("am", amount.toString());
  params.set("cu", "INR");
  if (txnRef) params.set("tn", txnRef);
  return `upi://pay?${params.toString()}`;
}

function generateTxnRef() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `DEVCRAFT${ts}${rand}`.toUpperCase();
}

export default function UPIPaymentModal({ enrollmentId, amount, onSuccess, onClose }) {
  const [upiSettings, setUpiSettings] = useState(null);
  const [txnRef, setTxnRef] = useState(generateTxnRef());
  const [transactionId, setTransactionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(300);

  useEffect(() => {
    fetchUPISettings().then((s) => {
      if (s) setUpiSettings(s);
    });
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setTxnRef(generateTxnRef());
      setCountdown(300);
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const upiLink = upiSettings?.upiId
    ? encodeUPI(upiSettings.upiId, upiSettings.upiName || "DEVCRAFT", amount, txnRef)
    : "";
  const qrUrl = upiLink ? `${QR_API}${encodeURIComponent(upiLink)}` : "";

  const handleSubmit = async () => {
    const tid = transactionId.trim();
    if (!tid) {
      setError("Please enter the transaction ID from your UPI payment.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitTransactionId(enrollmentId, tid);
      setSubmitted(true);
    } catch (err) {
      setError("Failed to submit transaction ID: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000, overflowY: "auto", padding: "2rem 0" }}>
      <div style={{ background: "#fff", border: "3px solid #000", padding: "2rem", width: "90%", maxWidth: "480px", boxShadow: "8px 8px 0 #000", maxHeight: "calc(100vh - 4rem)", overflowY: "auto" }}>
        <div style={{ height: "6px", background: "#000", marginBottom: "1.5rem", margin: "-2rem -2rem 1.5rem -2rem" }} />

        {!submitted ? (
          <>
            <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.2rem", marginBottom: "0.5rem" }}>
              Pay via UPI
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>
              Scan the QR code below to pay <strong>₹{amount}</strong> using any UPI app.
            </p>

            {!upiSettings?.upiId ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#EA4335", fontWeight: 700, fontSize: "0.9rem" }}>
                UPI ID not configured by admin yet. Please contact support.
              </div>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                  {qrUrl && (
                    <img
                      src={qrUrl}
                      alt="UPI QR Code"
                      style={{ width: "280px", height: "280px", border: "2px solid #000", imageRendering: "pixelated" }}
                    />
                  )}
                  <div style={{ fontSize: "0.78rem", color: "#888", marginTop: "0.5rem" }}>
                    QR refreshes in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                  </div>
                </div>

                <div style={{ fontSize: "0.82rem", color: "#555", marginBottom: "0.75rem", padding: "0.75rem", background: "#f5f5f5", border: "1px solid #ddd" }}>
                  <div><strong>UPI ID:</strong> {upiSettings.upiId}</div>
                  <div><strong>Payee:</strong> {upiSettings.upiName || "DEVCRAFT"}</div>
                  <div><strong>Amount:</strong> ₹{amount}</div>
                </div>

                <div style={{ borderTop: "2px solid #eee", paddingTop: "1rem", marginTop: "0.5rem" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
                    Enter Transaction ID (UPI Reference / UTR Number)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC123456789"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    style={{
                      width: "100%", padding: "0.65rem 0.85rem", border: "2px solid #000",
                      fontSize: "0.88rem", fontFamily: "inherit", boxSizing: "border-box", outline: "none",
                    }}
                  />
                  <p style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.3rem" }}>
                    Your transaction ID will be verified by the admin. Certificate will unlock only after manual verification.
                  </p>
                </div>

                {error && <div style={{ color: "#EA4335", fontSize: "0.85rem", fontWeight: 700, marginTop: "0.75rem" }}>{error}</div>}

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                  <button onClick={handleSubmit} disabled={submitting} className="btn-sharp" style={{ flex: 1, padding: "0.75rem", fontWeight: 800 }}>
                    {submitting ? "Submitting..." : "Submit Transaction ID"}
                  </button>
                  {onClose && (
                    <button type="button" onClick={onClose} className="btn-sharp" style={{ background: "#fff", color: "#000", border: "2px solid #000", padding: "0.75rem 1.5rem" }}>
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ marginBottom: "1rem" }}></div>
            <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.2rem", marginBottom: "0.75rem" }}>
              Transaction ID Submitted
            </h3>
            <p style={{ fontSize: "0.88rem", color: "#555", lineHeight: "1.6" }}>
              Your transaction ID <strong>{transactionId}</strong> has been recorded.
              The admin will verify it shortly. Once verified, your certificate will be unlocked.
            </p>
            <button onClick={onSuccess} className="btn-sharp" style={{ marginTop: "1.5rem", padding: "0.75rem 2rem", fontWeight: 800 }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
