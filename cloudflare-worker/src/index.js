export default {
  async scheduled(event, env, ctx) {
    const url = env.VERCEL_API_URL || "https://devcraft.rutujdhodapkar.tech";
    const secret = env.CRON_SECRET;
    if (!secret) {
      console.error("CRON_SECRET not set");
      return;
    }
    try {
      const resp = await fetch(`${url}/api/linkedin/post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": secret,
        },
      });
      const body = await resp.text();
      console.log(`Status ${resp.status}: ${body}`);
    } catch (e) {
      console.error("Failed:", e.message);
    }
  },

  async fetch(request, env, ctx) {
    return new Response(JSON.stringify({ ok: true, message: "LinkedIn automation worker active" }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
