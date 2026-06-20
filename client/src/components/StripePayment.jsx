import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { fetchStripeConfig, createPaymentIntent } from "../services/data";

function PaymentForm({ enrollmentId, amount, paymentStage, onSuccess, onError, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");
    const { error: submitError } = await elements.submit();
    if (submitError) { setError(submitError.message); setLoading(false); return; }
    const { error: payError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (payError) { setError(payError.message); setLoading(false); return; }
    if (paymentIntent.status === "succeeded") {
      onSuccess();
    } else {
      setError("Payment was not successful. Status: " + paymentIntent.status);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: "1rem 0" }}>
      <PaymentElement />
      {error && <div style={{ color: "#EA4335", fontSize: "0.85rem", marginTop: "0.75rem", fontWeight: 700 }}>{error}</div>}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
        <button type="submit" disabled={!stripe || loading} className="btn-sharp" style={{ flex: 1, padding: "0.75rem", fontWeight: 800 }}>
          {loading ? "Processing..." : `Pay ₹${amount}`}
        </button>
        {onClose && <button type="button" onClick={onClose} className="btn-sharp" style={{ background: "#fff", color: "#000", border: "2px solid #000", padding: "0.75rem 1.5rem" }}>Cancel</button>}
      </div>
    </form>
  );
}

export default function StripePaymentModal({ enrollmentId, amount, paymentStage = "full", onSuccess, onClose }) {
  const [stripePromise, setStripePromise] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const config = await fetchStripeConfig();
        setStripePromise(loadStripe(config.publishableKey));
        const pi = await createPaymentIntent(enrollmentId, amount, paymentStage);
        setClientSecret(pi.clientSecret);
      } catch (err) {
        setError("Failed to initialize payment: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [enrollmentId, amount, paymentStage]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
      <div style={{ background: "#fff", border: "3px solid #000", padding: "2rem", width: "90%", maxWidth: "480px", boxShadow: "8px 8px 0 #000" }}>
        <div style={{ height: "6px", background: "#000", marginBottom: "1.5rem", margin: "-2rem -2rem 1.5rem -2rem" }} />
        <h3 style={{ fontWeight: 900, textTransform: "uppercase", fontSize: "1.2rem", marginBottom: "0.5rem" }}>Complete Payment</h3>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>Pay ₹{amount} to unlock your internship.</p>
        {loading && <p style={{ color: "#888" }}>Loading payment...</p>}
        {error && <div style={{ color: "#EA4335", fontSize: "0.85rem", fontWeight: 700 }}>{error}</div>}
        {clientSecret && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm enrollmentId={enrollmentId} amount={amount} paymentStage={paymentStage} onSuccess={onSuccess} onError={setError} onClose={onClose} />
          </Elements>
        )}
      </div>
    </div>
  );
}
