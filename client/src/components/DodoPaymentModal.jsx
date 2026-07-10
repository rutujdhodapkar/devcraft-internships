import React, { useEffect, useState, useRef } from "react";
import { fetchEnrollmentById, fetchDodoConfig } from "../services/data";

const API_BASE = (import.meta.env.VITE_SERVER_URL || "https://devcraft.fennark.xyz").replace(/\/api\/?$/, "");

export default function DodoPaymentModal({ enrollmentId, amount, onSuccess, onClose, userEmail, userName }) {
  const [status, setStatus] = useState("creating");
  const [errorMessage, setErrorMessage] = useState("");
  const initRef = useRef(false);
  const pollingRef = useRef(false);
  const paidRef = useRef(false);

  const startPolling = () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const enr = await fetchEnrollmentById(enrollmentId);
        if (enr?.paymentStatus === "paid" || enr?.paymentStage === "fully_paid") {
          setStatus("completed");
          return;
        }
      } catch {}
      if (attempts < 30) setTimeout(poll, 2000);
      else { setStatus("error"); setErrorMessage("Payment confirmation is taking longer than expected. Please check your enrollment status or contact support."); }
    };
    setTimeout(poll, 2000);
  };

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      try {
        const config = await fetchDodoConfig();
        const mode = config?.mode === "live" ? "live" : "test";
        const mod = await import("dodopayments-checkout");
        const DodoPayments = mod.DodoPayments;
        DodoPayments.Initialize({
          mode,
          displayType: "overlay",
          onEvent: (event) => {
            if (event.event_type === "payment.succeeded") {
              paidRef.current = true;
              setStatus("completed");
            }
            if (event.event_type === "checkout.error") {
              setStatus("error");
              setErrorMessage(event.data?.message || "Payment error");
            }
            if (event.event_type === "checkout.closed" && !paidRef.current) {
              startPolling();
            }
          },
        });
        const res = await fetch(`${API_BASE}/api/dodo/create-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, enrollmentId, customerEmail: userEmail, customerName: userName }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || "Failed to create checkout");
        setStatus("processing");
        await DodoPayments.Checkout.open({ checkoutUrl: data.data.checkout_url });
      } catch (err) {
        setStatus("error");
        setErrorMessage(err.message);
      }
    })();
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000, overflowY: "auto", padding: "2rem 0" }}>
      <div style={{ background: "#fff", border: "3px solid #000", padding: "2rem", width: "90%", maxWidth: "460px", boxShadow: "8px 8px 0 #000", textAlign: "center" }}>
        <div style={{ height: "6px", background: "#000", marginBottom: "1.5rem", margin: "-2rem -2rem 1.5rem -2rem" }} />
        {(status === "creating" || status === "processing") && (
          <>
            <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.15rem", marginBottom: "0.5rem" }}>
              {status === "creating" ? "Preparing Checkout..." : "Complete Payment"}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
              {status === "creating"
                ? "Setting up secure payment..."
                : "A secure payment window has opened. Complete payment there."}
            </p>
            <p style={{ fontSize: "0.78rem", color: "#999" }}>
              Amount: <strong>{"\u20B9"}{amount}</strong>
            </p>
            {status === "processing" && (
              <button onClick={onClose} className="btn-sharp" style={{ marginTop: "1rem", background: "#fff", color: "#000", border: "2px solid #000", padding: "0.5rem 1.5rem", fontSize: "0.82rem" }}>
                Close
              </button>
            )}
          </>
        )}
        {status === "completed" && (
          <>
            <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.15rem", marginBottom: "0.75rem" }}>
              Payment Successful
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#555", lineHeight: "1.6" }}>
              Your payment of <strong>{"\u20B9"}{amount}</strong> has been confirmed.
            </p>
            <button onClick={onSuccess} className="btn-sharp" style={{ marginTop: "1.5rem", padding: "0.75rem 2rem", fontWeight: 800 }}>
              Done
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.15rem", marginBottom: "0.75rem", color: "#EA4335" }}>
              Payment Error
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#555", lineHeight: "1.6" }}>
              {errorMessage || "Something went wrong."}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem" }}>
              <button onClick={() => { setStatus("creating"); initRef.current = false; setErrorMessage(""); }} className="btn-sharp" style={{ padding: "0.65rem 1.5rem", fontWeight: 800 }}>
                Retry
              </button>
              <button onClick={onClose} className="btn-sharp" style={{ background: "#fff", color: "#000", border: "2px solid #000", padding: "0.65rem 1.5rem" }}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
