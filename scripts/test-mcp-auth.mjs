// Local test: prove mcp-domains enforces auth + approval like a real client.
import { signJwt } from "../server/auth.js";
import { handleToolCall } from "../mcp-domains/server.js";

const SECRET = process.env.CRYPTO_SECRET || "test-secret-local";
process.env.CRYPTO_SECRET = SECRET;

const adminJwt = signJwt({ email: "rutujdhodapkar@gmail.com", role: "admin", source: "google" });
const pendingJwt = signJwt({ email: "newbie@gmail.com", role: "pending", source: "google" });
const userJwt = signJwt({ email: "approveduser@gmail.com", role: "user", source: "google" });

async function tryCall(label, args) {
  try {
    const r = await handleToolCall(args.tool, args.callArgs);
    console.log(`✅ ${label}: ${String(r).slice(0, 80)}`);
  } catch (e) {
    console.log(`⛔ ${label}: ${e.message}`);
  }
}

console.log("=== No credentials ===");
await tryCall("get_domains (anon)", { tool: "get_domains", callArgs: {} });
await tryCall("request_access (anon)", { tool: "request_access", callArgs: { email: "x@y.com" } });

console.log("\n=== Pending (signed in, NOT approved) ===");
await tryCall("request_access (pending)", { tool: "request_access", callArgs: { bearer: pendingJwt } });
await tryCall("get_domains (pending)", { tool: "get_domains", callArgs: { bearer: pendingJwt } });
await tryCall("approve_user (pending)", { tool: "approve_user", callArgs: { admin_token: pendingJwt, email: "x@y.com" } });

console.log("\n=== Approved user (role user) ===");
await tryCall("get_domains (user)", { tool: "get_domains", callArgs: { bearer: userJwt } });

console.log("\n=== Admin (approved) ===");
await tryCall("get_domains (admin)", { tool: "get_domains", callArgs: { bearer: adminJwt } });
await tryCall("approve_user (admin)", { tool: "approve_user", callArgs: { admin_token: adminJwt, email: "someone@gmail.com", allowed_tools: "get_domains" } });
