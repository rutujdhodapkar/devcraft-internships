export default async function handler(req, res) {
  const key = process.env.STRIPE_PUBLISHABLE_KEY || "";
  res.status(200).json({ success: true, data: { publishableKey: key } });
}
