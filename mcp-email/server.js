import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "support@fennark.xyz";
const FROM_NAME = process.env.FROM_NAME || "DEV/CRAFT";
const BREVO_API_URL = "https://api.brevo.com/v3";

async function brevoFetch(path, options = {}) {
  const res = await fetch(`${BREVO_API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY, ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

const server = new Server(
  { name: "mcp-email-automation", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "send_email",
      description: "Send a transactional email via Brevo",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email" },
          subject: { type: "string" },
          html: { type: "string", description: "HTML body" },
          category: { type: "string", description: "Email category tag" },
        },
        required: ["to", "subject", "html"],
      },
    },
    {
      name: "send_campaign_email",
      description: "Send campaign email with HTML template wrapping",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
          campaign_name: { type: "string" },
        },
        required: ["to", "subject", "body"],
      },
    },
    {
      name: "create_contact",
      description: "Create or update a Brevo contact",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string" },
          name: { type: "string" },
          list_ids: { type: "array", items: { type: "number" } },
        },
        required: ["email"],
      },
    },
    {
      name: "get_campaign_stats",
      description: "Get email campaign statistics",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Campaigns to fetch (default 10)" },
        },
      },
    },
    {
      name: "get_email_templates",
      description: "List Brevo email templates",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "send_email": {
        const { to, subject, html, category } = args;
        const data = await brevoFetch("/smtp/email", {
          method: "POST",
          body: JSON.stringify({
            sender: { name: FROM_NAME, email: FROM_EMAIL },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            tag: category || "general",
          }),
        });
        return { content: [{ type: "text", text: `Email sent: ${data.messageId}` }] };
      }

      case "send_campaign_email": {
        const { to, subject, body, campaign_name } = args;
        const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2>${subject}</h2>
          <p>${body.replace(/\n/g, "</p><p>")}</p>
          <hr><small style="color:#888">DEV/CRAFT — ${campaign_name || "Campaign"}</small>
        </div>`;
        const data = await brevoFetch("/smtp/email", {
          method: "POST",
          body: JSON.stringify({
            sender: { name: FROM_NAME, email: FROM_EMAIL },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            tag: campaign_name || "campaign",
          }),
        });
        return { content: [{ type: "text", text: `Campaign email sent: ${data.messageId}` }] };
      }

      case "create_contact": {
        const { email, name, list_ids } = args;
        const data = await brevoFetch("/contacts", {
          method: "POST",
          body: JSON.stringify({
            email,
            attributes: { FIRSTNAME: name || "" },
            listIds: list_ids || [],
            updateEnabled: true,
          }),
        });
        return { content: [{ type: "text", text: `Contact created/updated: ${email} (ID: ${data.id || "ok"})` }] };
      }

      case "get_campaign_stats": {
        const { limit = 10 } = args;
        const data = await brevoFetch(`/emailCampaigns?limit=${limit}`);
        const summary = (data.campaigns || []).map(c =>
          `• ${c.name}: sent=${c.sentCount} opened=${c.openRate} clicked=${c.clickRate}`
        ).join("\n") || "No campaigns found";
        return { content: [{ type: "text", text: summary }] };
      }

      case "get_email_templates": {
        const { limit = 20 } = args;
        const data = await brevoFetch(`/smtp/templates?limit=${limit}`);
        const summary = (data.templates || []).map(t =>
          `• ID:${t.id} — ${t.name} (${t.isActive ? "active" : "inactive"})`
        ).join("\n") || "No templates found";
        return { content: [{ type: "text", text: summary }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

async function main() {
  if (!BREVO_API_KEY) {
    console.error("BREVO_API_KEY environment variable required");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
