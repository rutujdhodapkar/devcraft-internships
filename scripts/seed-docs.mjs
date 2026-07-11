// Seed comprehensive HTML documentation for MCP and Uni/Org pages into Firestore.
// Run: FIREBASE_SERVICE_ACCOUNT='{...json...}' node scripts/seed-docs.mjs

const MCP_HTML = `<div class="mcp-docs-wrapper" style="font-family: system-ui, sans-serif; line-height: 1.7; color: #222;">
  <h2 style="font-size: 1.6rem; font-weight: 900; text-transform: uppercase; margin: 0 0 0.5rem;">What is MCP?</h2>
  <p style="font-size: 1rem; color: #444; max-width: 720px;">MCP (Model Context Protocol) is a JSON-RPC API that lets you query DEV/CRAFT internship data, browse projects, and submit change proposals — all from your own tools, scripts, or AI assistants.</p>

  <hr style="border: none; border-top: 3px solid #000; margin: 1.5rem 0;" />

  <h3 style="font-size: 1.15rem; font-weight: 800; text-transform: uppercase;">Supported Use Cases</h3>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin: 1rem 0;">
    <div style="border: 2px solid #000; padding: 1rem; background: #fafafa;">
      <div style="font-size: 1.5rem;">📋</div>
      <h4 style="margin: 0.4rem 0 0.2rem;">Browse Domains</h4>
      <p style="font-size: 0.85rem; margin: 0;">List all available internships, their durations, prices, features, and projects.</p>
    </div>
    <div style="border: 2px solid #000; padding: 1rem; background: #fafafa;">
      <div style="font-size: 1.5rem;">🔍</div>
      <h4 style="margin: 0.4rem 0 0.2rem;">Query Data</h4>
      <p style="font-size: 0.85rem; margin: 0;">Use <code>lookup</code> to search enrollments, users, payments, badges, and more with filters.</p>
    </div>
    <div style="border: 2px solid #000; padding: 1rem; background: #fafafa;">
      <div style="font-size: 1.5rem;">✏️</div>
      <h4 style="margin: 0.4rem 0 0.2rem;">Suggest Changes</h4>
      <p style="font-size: 0.85rem; margin: 0;">Add domains, tasks, or edit data — all staged as proposals for admin review.</p>
    </div>
    <div style="border: 2px solid #000; padding: 1rem; background: #fafafa;">
      <div style="font-size: 1.5rem;">🔔</div>
      <h4 style="margin: 0.4rem 0 0.2rem;">Webhook Notifications</h4>
      <p style="font-size: 0.85rem; margin: 0;">Receive real-time notifications when proposals are approved or rejected.</p>
    </div>
  </div>

  <hr style="border: none; border-top: 3px solid #000; margin: 1.5rem 0;" />

  <h3 style="font-size: 1.15rem; font-weight: 800; text-transform: uppercase;">Authentication</h3>
  <div style="border: 2px solid #000; padding: 1.25rem; background: #f5f5f5; margin: 0.75rem 0;">
    <p style="margin: 0 0 0.5rem;"><strong>Option 1: Token argument</strong><br /><code style="background: #e0e0e0; padding: 0.15rem 0.4rem; font-size: 0.9rem;">{ "user_token": "YOUR_FIREBASE_TOKEN" }</code></p>
    <p style="margin: 0 0 0.5rem;"><strong>Option 2: Authorization header</strong><br /><code style="background: #e0e0e0; padding: 0.15rem 0.4rem; font-size: 0.9rem;">Authorization: Bearer YOUR_FIREBASE_TOKEN</code></p>
    <p style="margin: 0; font-size: 0.85rem;">Your token is your Firebase ID token. Get it from the Workspace tab above (Copy token button). Tokens expire and should be refreshed regularly.</p>
  </div>

  <hr style="border: none; border-top: 3px solid #000; margin: 1.5rem 0;" />

  <h3 style="font-size: 1.15rem; font-weight: 800; text-transform: uppercase;">Available Tools</h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 0.75rem 0;">
    <thead><tr style="background: #000; color: #fff;">
      <th style="border: 1px solid #000; padding: 0.5rem; text-align: left;">Tool</th>
      <th style="border: 1px solid #000; padding: 0.5rem; text-align: left;">Type</th>
      <th style="border: 1px solid #000; padding: 0.5rem; text-align: left;">Description</th>
    </tr></thead>
    <tbody>
      <tr><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem; font-weight: 700;">get_domains</td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;"><span style="background: #e8f5e9; padding: 0.15rem 0.5rem; font-size: 0.8rem;">Read</span></td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;">List all internship domains/career paths</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem; font-weight: 700;">get_tasks</td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;"><span style="background: #e8f5e9; padding: 0.15rem 0.5rem; font-size: 0.8rem;">Read</span></td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;">List projects/tasks for a specific domain</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem; font-weight: 700;">lookup</td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;"><span style="background: #e8f5e9; padding: 0.15rem 0.5rem; font-size: 0.8rem;">Read</span></td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;">Query any collection with field filters</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem; font-weight: 700;">collections</td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;"><span style="background: #e8f5e9; padding: 0.15rem 0.5rem; font-size: 0.8rem;">Read</span></td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;">List all available data collections</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem; font-weight: 700;">add_domain</td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;"><span style="background: #fff8e1; padding: 0.15rem 0.5rem; font-size: 0.8rem;">Proposal</span></td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;">Suggest a new internship domain</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem; font-weight: 700;">add_task</td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;"><span style="background: #fff8e1; padding: 0.15rem 0.5rem; font-size: 0.8rem;">Proposal</span></td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;">Suggest adding a project/quiz to a domain</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem; font-weight: 700;">remove_domain</td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;"><span style="background: #fff8e1; padding: 0.15rem 0.5rem; font-size: 0.8rem;">Proposal</span></td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;">Suggest removing a domain</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem; font-weight: 700;">edit_data</td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;"><span style="background: #fff8e1; padding: 0.15rem 0.5rem; font-size: 0.8rem;">Proposal</span></td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;">Propose create/update/delete on any collection</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem; font-weight: 700;">list_changes</td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;"><span style="background: #e8f5e9; padding: 0.15rem 0.5rem; font-size: 0.8rem;">Read</span></td><td style="border: 1px solid #ccc; padding: 0.4rem 0.6rem;">View your pending/approved/rejected proposals</td></tr>
    </tbody>
  </table>

  <hr style="border: none; border-top: 3px solid #000; margin: 1.5rem 0;" />

  <h3 style="font-size: 1.15rem; font-weight: 800; text-transform: uppercase;">Code Examples</h3>

  <div style="border: 2px solid #000; margin: 1rem 0;">
    <div style="background: #000; color: #fff; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 700;">Python</div>
    <pre style="background: #1e1e1e; color: #d4d4d4; padding: 1rem; margin: 0; font-size: 0.82rem; overflow-x: auto; line-height: 1.5;"><code>import requests, json

MCP = "https://devcraft.fennark.xyz/api/mcp-domains"
TOKEN = "your_mcp_token"

def call(tool, args=None):
    r = requests.post(MCP, json={
        "jsonrpc": "2.0", "id": 1,
        "method": "tools/call",
        "params": {"name": tool, "arguments": {**(args or {}), "user_token": TOKEN}}
    })
    return r.json()

# List domains
domains = call("get_domains")
for d in domains.get("result",{}).get("content",[]):
    print(d["text"])

# Lookup with filter
data = call("lookup", {"collection": "careerPaths"})
print(data)

# Propose a new domain
resp = call("add_domain", {
    "id": "my-domain", "title": "My Domain",
    "duration": "6 Weeks", "paymentAmount": 199
})
print(resp)</code></pre>
  </div>

  <div style="border: 2px solid #000; margin: 1rem 0;">
    <div style="background: #000; color: #fff; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 700;">JavaScript / Node.js</div>
    <pre style="background: #1e1e1e; color: #d4d4d4; padding: 1rem; margin: 0; font-size: 0.82rem; overflow-x: auto; line-height: 1.5;"><code>const MCP = "https://devcraft.fennark.xyz/api/mcp-domains";

async function call(tool, args = {}) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      jsonrpc: "2.0", id: Date.now(),
      method: "tools/call",
      params: {name: tool, arguments: {...args, user_token: "your_mcp_token"}},
    }),
  });
  return res.json();
}

const domains = await call("get_domains");
console.log(domains);</code></pre>
  </div>

  <div style="border: 2px solid #000; margin: 1rem 0;">
    <div style="background: #000; color: #fff; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 700;">cURL</div>
    <pre style="background: #1e1e1e; color: #d4d4d4; padding: 1rem; margin: 0; font-size: 0.82rem; overflow-x: auto; line-height: 1.5;"><code>curl -X POST https://devcraft.fennark.xyz/api/mcp-domains \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_domains",
      "arguments": {"user_token": "your_mcp_token"}
    }
  }'</code></pre>
  </div>

  <div style="border: 2px solid #000; margin: 1rem 0;">
    <div style="background: #000; color: #fff; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 700;">Go</div>
    <pre style="background: #1e1e1e; color: #d4d4d4; padding: 1rem; margin: 0; font-size: 0.82rem; overflow-x: auto; line-height: 1.5;"><code>package main

import (
    "bytes" "encoding/json" "fmt" "net/http"
)

func call(tool string, args map[string]any) (map[string]any, error) {
    if args == nil { args = map[string]any{} }
    args["user_token"] = "your_mcp_token"
    body, _ := json.Marshal(map[string]any{
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": map[string]any{"name": tool, "arguments": args},
    })
    r, _ := http.Post("https://devcraft.fennark.xyz/api/mcp-domains",
        "application/json", bytes.NewReader(body))
    defer r.Body.Close()
    var res map[string]any
    json.NewDecoder(r.Body).Decode(&res)
    return res, nil
}

func main() {
    d, _ := call("get_domains", nil)
    fmt.Println(d)
}</code></pre>
  </div>

  <hr style="border: none; border-top: 3px solid #000; margin: 1.5rem 0;" />

  <h3 style="font-size: 1.15rem; font-weight: 800; text-transform: uppercase;">Error Codes</h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin: 0.75rem 0;">
    <thead><tr style="background: #000; color: #fff;">
      <th style="border: 1px solid #000; padding: 0.4rem 0.6rem; text-align: left;">Code</th>
      <th style="border: 1px solid #000; padding: 0.4rem 0.6rem; text-align: left;">Meaning</th>
      <th style="border: 1px solid #000; padding: 0.4rem 0.6rem; text-align: left;">Action</th>
    </tr></thead>
    <tbody>
      <tr><td style="border: 1px solid #ccc; padding: 0.3rem 0.5rem;">-32700</td><td style="border: 1px solid #ccc; padding: 0.3rem 0.5rem;">Parse error</td><td style="border: 1px solid #ccc; padding: 0.3rem 0.5rem;">Check your JSON syntax</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 0.3rem 0.5rem;">-32603</td><td style="border: 1px solid #ccc; padding: 0.3rem 0.5rem;">Tool error</td><td style="border: 1px solid #ccc; padding: 0.3rem 0.5rem;">Check the error message for details</td></tr>
      <tr><td style="border: 1px solid #ccc; padding: 0.3rem 0.5rem;">-32001</td><td style="border: 1px solid #ccc; padding: 0.3rem 0.5rem;">Unauthorized</td><td style="border: 1px solid #ccc; padding: 0.3rem 0.5rem;">Sign in and refresh your token</td></tr>
    </tbody>
  </table>

  <div style="margin-top: 1.5rem; padding: 1.25rem; background: #fffde7; border: 2px solid #f9a825;">
    <h4 style="margin: 0 0 0.4rem; font-size: 0.95rem;">Need help?</h4>
    <p style="margin: 0; font-size: 0.85rem;">Contact the admin at <a href="mailto:rutujdhodapkar@gmail.com">rutujdhodapkar@gmail.com</a> or raise an issue on GitHub.</p>
  </div>
</div>`;

const UNI_HTML = `<div class="uni-docs-wrapper" style="font-family: system-ui, sans-serif; line-height: 1.7; color: #222;">
  <h2 style="font-size: 1.6rem; font-weight: 900; text-transform: uppercase; margin: 0 0 0.5rem;">For Universities & Organizations</h2>
  <p style="font-size: 1rem; color: #444; max-width: 720px;">DEV/CRAFT partners with universities, colleges, training organizations, and companies to provide structured virtual internship programs. Set up a branded workspace, manage learners, issue certificates, and track progress — all from one dashboard.</p>

  <hr style="border: none; border-top: 3px solid #000; margin: 1.5rem 0;" />

  <h3 style="font-size: 1.15rem; font-weight: 800; text-transform: uppercase;">What You Get</h3>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin: 1rem 0;">
    <div style="border: 2px solid #000; padding: 1rem; background: #fafafa;">
      <div style="font-size: 1.5rem;">🏫</div>
      <h4 style="margin: 0.4rem 0 0.2rem;">Branded Workspace</h4>
      <p style="font-size: 0.85rem; margin: 0;">Custom portal with your logo, name, and program listings.</p>
    </div>
    <div style="border: 2px solid #000; padding: 1rem; background: #fafafa;">
      <div style="font-size: 1.5rem;">📊</div>
      <h4 style="margin: 0.4rem 0 0.2rem;">Learner Analytics</h4>
      <p style="font-size: 0.85rem; margin: 0;">Track enrollment, completion rates, at-risk learners, and revenue.</p>
    </div>
    <div style="border: 2px solid #000; padding: 1rem; background: #fafafa;">
      <div style="font-size: 1.5rem;">📜</div>
      <h4 style="margin: 0.4rem 0 0.2rem;">Certificate Issuance</h4>
      <p style="font-size: 0.85rem; margin: 0;">Auto or manual certificate generation with customizable templates.</p>
    </div>
    <div style="border: 2px solid #000; padding: 1rem; background: #fafafa;">
      <div style="font-size: 1.5rem;">🛠️</div>
      <h4 style="margin: 0.4rem 0 0.2rem;">Custom Programs</h4>
      <p style="font-size: 0.85rem; margin: 0;">Create courses, set durations, define completion criteria and badges.</p>
    </div>
  </div>

  <hr style="border: none; border-top: 3px solid #000; margin: 1.5rem 0;" />

  <h3 style="font-size: 1.15rem; font-weight: 800; text-transform: uppercase;">How to Get Started</h3>
  <ol style="font-size: 0.95rem; line-height: 2;">
    <li><strong>Submit an application</strong> — fill out the Request Access form with your organization details.</li>
    <li><strong>Admin reviews</strong> — our team verifies your organization and approves your workspace.</li>
    <li><strong>Configure your workspace</strong> — set up programs, templates, certificate rules, and branding.</li>
    <li><strong>Invite learners</strong> — share the program link or enroll students directly from the dashboard.</li>
    <li><strong>Track and certify</strong> — monitor progress, verify tasks, and issue certificates on completion.</li>
  </ol>

  <hr style="border: none; border-top: 3px solid #000; margin: 1.5rem 0;" />

  <h3 style="font-size: 1.15rem; font-weight: 800; text-transform: uppercase;">Workspace Features</h3>

  <div style="border: 2px solid #000; padding: 1.25rem; margin: 0.75rem 0; background: #f5f5f5;">
    <h4 style="margin: 0 0 0.5rem;">Programs / Courses</h4>
    <p style="margin: 0; font-size: 0.9rem;">Create structured programs with titles, durations, and descriptions. Each program can have its own set of projects, quizzes, and completion criteria. Learners enroll and work through the curriculum at their own pace.</p>
  </div>

  <div style="border: 2px solid #000; padding: 1.25rem; margin: 0.75rem 0; background: #f5f5f5;">
    <h4 style="margin: 0 0 0.5rem;">Templates</h4>
    <p style="margin: 0; font-size: 0.9rem;">Create reusable templates for onboarding briefs, project guidelines, offer letters, and certificates. Templates are stored per-workspace and can be used across multiple programs.</p>
  </div>

  <div style="border: 2px solid #000; padding: 1.25rem; margin: 0.75rem 0; background: #f5f5f5;">
    <h4 style="margin: 0 0 0.5rem;">Organization Settings</h4>
    <p style="margin: 0; font-size: 0.9rem;">Configure domains, homepage placement, certificate templates, badge criteria, completion percentage, minimum scores, required modules, payment methods, fees, stipends, refund rules, and contact information. All settings are managed per-workspace.</p>
  </div>

  <div style="border: 2px solid #000; padding: 1.25rem; margin: 0.75rem 0; background: #f5f5f5;">
    <h4 style="margin: 0 0 0.5rem;">Team Management</h4>
    <p style="margin: 0; font-size: 0.9rem;">The workspace owner can invite additional administrators. Each team member can manage learners, programs, and templates. Roles include owner and admin with different permission levels.</p>
  </div>

  <hr style="border: none; border-top: 3px solid #000; margin: 1.5rem 0;" />

  <h3 style="font-size: 1.15rem; font-weight: 800; text-transform: uppercase;">Learner Management</h3>
  <ul style="font-size: 0.9rem; line-height: 1.8;">
    <li><strong>Applicants tab</strong> — view all enrolled learners with status (pending, active, completed)</li>
    <li><strong>Export CSV</strong> — download learner data for external reporting</li>
    <li><strong>Completion tracking</strong> — see who has completed all tasks and is ready for certification</li>
    <li><strong>At-risk identification</strong> — learners with no submissions are flagged for follow-up</li>
    <li><strong>Certificate issuance</strong> — manual approval or auto-issuance based on completion criteria</li>
  </ul>

  <hr style="border: none; border-top: 3px solid #000; margin: 1.5rem 0;" />

  <h3 style="font-size: 1.15rem; font-weight: 800; text-transform: uppercase;">Subscription Plans</h3>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0;">
    <div style="border: 2px solid #000; padding: 1rem; text-align: center; background: #fff;">
      <h4 style="margin: 0 0 0.25rem;">Starter</h4>
      <p style="font-size: 0.85rem;">Small cohorts, basic analytics, manual certificate issuance</p>
    </div>
    <div style="border: 2px solid #000; padding: 1rem; text-align: center; background: #fffde7;">
      <h4 style="margin: 0 0 0.25rem;">Growth</h4>
      <p style="font-size: 0.85rem;">Multi-admin, custom branding, advanced analytics</p>
    </div>
    <div style="border: 2px solid #000; padding: 1rem; text-align: center; background: #f0f0f0;">
      <h4 style="margin: 0 0 0.25rem;">Enterprise</h4>
      <p style="font-size: 0.85rem;">White-label, SSO, custom reporting, dedicated support</p>
    </div>
  </div>

  <div style="margin-top: 1.5rem; padding: 1.25rem; background: #e3f2fd; border: 2px solid #1a73e8;">
    <h4 style="margin: 0 0 0.4rem; font-size: 0.95rem;">Ready to partner?</h4>
    <p style="margin: 0; font-size: 0.85rem;">Fill out the Request Access form above and our team will review your application. For questions, email <a href="mailto:rutujdhodapkar@gmail.com">rutujdhodapkar@gmail.com</a>.</p>
  </div>
</div>`;

async function seed() {
  const { initFirestore } = await import('../server/firestore.js');
  const fs = await initFirestore();
  if (!fs) { console.error('Firestore not available'); process.exit(1); }

  console.log('Seeding MCP documentation...');
  await fs.collection('siteConfig').doc('partnerDetails_mcp').set({
    value: {
      ...((await fs.collection('siteConfig').doc('partnerDetails_mcp').get()).data()?.value || {}),
      html: MCP_HTML,
    },
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  console.log('MCP docs seeded');

  console.log('Seeding University documentation...');
  await fs.collection('siteConfig').doc('partnerDetails_university').set({
    value: {
      ...((await fs.collection('siteConfig').doc('partnerDetails_university').get()).data()?.value || {}),
      html: UNI_HTML,
    },
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  console.log('University docs seeded');

  console.log('Done!');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
