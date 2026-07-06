import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

const server = new Server(
  { name: "mcp-social-automation", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "post_linkedin",
      description: "Post to LinkedIn using OAuth token",
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
          media_urls: { type: "array", items: { type: "string" } },
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
      name: "generate_content",
      description: "AI-generate LinkedIn post about DEV/CRAFT (uses NVIDIA_API_KEY or Cloudflare AI)",
      inputSchema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Theme: internships, success stories, tips, industry news", default: "internships" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
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
              "com.linkedin.ugc.MemberNetworkVisibility": visibility,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        return { content: [{ type: "text", text: `LinkedIn post published! ID: ${data.id}` }] };
      }

      case "post_twitter": {
        const { text } = args;
        const key = process.env.TWITTER_API_KEY;
        if (!key) return { content: [{ type: "text", text: "TWITTER_API_KEY not set" }] };
        return { content: [{ type: "text", text: `[SIMULATED] Tweet would be: "${text.substring(0, 50)}..."` }] };
      }

      case "post_instagram": {
        const { image_url, caption } = args;
        const key = process.env.INSTAGRAM_TOKEN;
        if (!key) return { content: [{ type: "text", text: "INSTAGRAM_TOKEN not set" }] };
        return { content: [{ type: "text", text: `[SIMULATED] Instagram: "${caption.substring(0, 50)}..."` }] };
      }

      case "generate_content": {
        const { topic = "internships" } = args;
        const nvidiaKey = process.env.NVIDIA_API_KEY;
        if (!nvidiaKey) return { content: [{ type: "text", text: "NVIDIA_API_KEY not set" }] };

        const promptMap = {
          internships: "Write an inspiring LinkedIn post about how virtual internships help students gain real-world skills and stand out in the job market. Mention DEV/CRAFT. 3-4 sentences. Add 3-5 relevant hashtags.",
          "success-stories": "Write a LinkedIn post about a student who transformed their career through a virtual internship program (DEV/CRAFT). Focus on the impact of hands-on experience. 3-4 sentences. Add 3-5 hashtags.",
          tips: "Write a LinkedIn post with practical tips for students looking to break into tech. Include the value of virtual internships (DEV/CRAFT). 3-4 sentences. Add 3-5 hashtags.",
          "industry-news": "Write a LinkedIn post about the future of remote work and virtual internships. Mention how platforms like DEV/CRAFT are leading this change. 3-4 sentences. Add 3-5 hashtags.",
        };

        const res = await fetch("https://api.nvcf.nvidia.com/v2/nvcf/pexec/functions/baek0be0-04b9-4c0a-b748-0a23a482b475", {
          method: "POST",
          headers: { Authorization: `Bearer ${nvidiaKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: promptMap[topic] || promptMap.internships }],
            temperature: 0.7,
            max_tokens: 500,
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`NVIDIA API error: ${err}`);
        }
        const json = await res.json();
        return { content: [{ type: "text", text: json.choices?.[0]?.message?.content || "Generation failed" }] };
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
