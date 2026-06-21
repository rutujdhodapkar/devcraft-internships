export default async function handler(req, res) {
  res.status(200).json({ success: true, data: { message: "Stripe has been removed. UPI payment is now used." } });
}
