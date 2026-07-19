import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { resolveIdentity } from "../server/auth.js";

const TEMPLATES = [
  "Join DEV/CRAFT and kickstart your career with hands-on virtual internships. Gain real-world skills, work on real projects, and earn verified completion certificates! 🚀\n\n#VirtualInternship #DEVRAFT #CareerGrowth #TechSkills #Internships",
  "Ready to level up? DEV/CRAFT offers free virtual internships with industry-relevant projects and verified completion certificates. No experience required!\n\n#FreeInternship #DEVRAFT #LearnToCode #CareerDevelopment #Tech",
  "Your dream internship is just a click away! Explore DEV/CRAFT's free virtual programs and build skills that matter.\n\n#Internship #DEVRAFT #TechCareers #SkillBuilding #FutureOfWork",
  "No experience? No problem. DEV/CRAFT provides structured virtual internships with mentorship, real-world projects, and verified certificates.\n\n#NoExperience #DEVRAFT #VirtualInternship #TechJobs #CareerGrowth",
  "The future of work is remote. DEV/CRAFT prepares you with virtual internships that mirror real-world workflows. Gain experience from anywhere.\n\n#RemoteWork #DEVRAFT #VirtualInternship #FutureOfWork #TechCareers",
  "Employers don't just want degrees — they want proof of skills. DEV/CRAFT's virtual internships give you portfolio-ready projects and verified certificates.\n\n#DEVRAFT #SkillsOverDegrees #TechCareers #Portfolio #Internships",
];

const server = new Server(
  { name: "mcp-social-automation", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "post_linkedin",
      description: "Post to LinkedIn using OAuth token (set LINKEDIN_ACCESS_TOKEN + LINKEDIN_PERSON_ID)",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Post content" },
          visibility: { type: "string", enum: ["PUBLIC", "CONNECTIONS"], default: "PUBLIC" },
        },
        required: ["text"],
      },
    },
    {
      name: "post_twitter",
      description: "Post to Twitter/X (requires TWITTER_API_KEY)",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
      },
    },
    {
      name: "post_instagram",
      description: "Post to Instagram (requires INSTAGRAM_TOKEN)",
      inputSchema: {
        type: "object",
        properties: {
          image_url: { type: "string" },
          caption: { type: "string" },
        },
        required: ["image_url", "caption"],
      },
    },
    {
      name: "generate_linkedin_post",
      description: "Generate a LinkedIn post about DEV/CRAFT (uses predefined templates, no API key needed)",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // generate_linkedin_post doesn't post to any platform — no auth needed
    if (name === "generate_linkedin_post") {
      const idx = new Date().getDate() % TEMPLATES.length;
      return { content: [{ type: "text", text: TEMPLATES[idx] }] };
    }

    // Every other social tool requires an authenticated admin/service identity.
    // Local opencode runs set MCP_LOCAL_TRUSTED=1; remote callers must pass a
    // Bearer JWT or MCP_API_KEY.
    const idn = await resolveIdentity({ bearer: args?.bearer, api_key: args?.api_key });
    if (!idn || idn.role !== "admin") {
      return { content: [{ type: "text", text: "Error: Unauthorized. Provide a valid Bearer token or API key." }], isError: true };
    }

    switch (name) {
      case "post_linkedin": {
        const { text, visibility = "PUBLIC" } = args;
        const token = process.env.LINKEDIN_ACCESS_TOKEN;
        const personId = process.env.LINKEDIN_PERSON_ID;
        if (!token) return { content: [{ type: "text", text: "LINKEDIN_ACCESS_TOKEN not set" }] };

        let author;
        if (personId) {
          author = `urn:li:person:${personId}`;
        } else {
          const me = await fetch("https://api.linkedin.com/v2/userinfo", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const meData = await me.json();
          if (!me.ok) return { content: [{ type: "text", text: `LinkedIn auth failed: ${meData.message || meData.error_description}` }], isError: true };
          author = `urn:li:person:${meData.sub}`;
        }

        const linkedinVisibility = visibility === "CONNECTIONS" ? "CONNECTIONS_ONLY" : "PUBLIC";
        let data;

        // Try new Posts API first
        try {
          const res = await fetch("https://api.linkedin.com/rest/posts", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "LinkedIn-Version": "202401",
            },
            body: JSON.stringify({
              author,
              lifecycleState: "PUBLISHED",
              visibility: linkedinVisibility,
              commentary: text,
              distribution: {
                feedDistribution: "MAIN_FEED",
                targetEntities: [],
                thirdPartyDistributionChannels: []
              },
              isReshareDisabledByAuthor: false,
            }),
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        } catch (newApiErr) {
          // Fall back to legacy Shares API
          const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "X-Restli-Protocol-Version": "2.0.0",
            },
            body: JSON.stringify({
              author,
              lifecycleState: "PUBLISHED",
              specificContent: {
                "com.linkedin.ugc.ShareContent": {
                  shareCommentary: { text },
                  shareMediaCategory: "NONE",
                },
              },
              visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": linkedinVisibility,
              },
            }),
          });
          data = await res.json();
          if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        }

        return { content: [{ type: "text", text: `LinkedIn post published! ID: ${data.id}` }] };
      }

      case "post_twitter": {
        const { text } = args;
        const key = process.env.TWITTER_API_KEY;
        if (!key) return { content: [{ type: "text", text: "TWITTER_API_KEY not set" }] };
        return { content: [{ type: "text", text: `[SIMULATED] Tweet: "${text.substring(0, 50)}..."` }] };
      }

      case "post_instagram": {
        const { image_url, caption } = args;
        const key = process.env.INSTAGRAM_TOKEN;
        if (!key) return { content: [{ type: "text", text: "INSTAGRAM_TOKEN not set" }] };
        return { content: [{ type: "text", text: `[SIMULATED] Instagram: "${caption.substring(0, 50)}..."` }] };
      }

      case "generate_linkedin_post": {
        // handled before auth check above
        throw new Error("Unexpected: generate_linkedin_post should not reach here");
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
