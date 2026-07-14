import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", "server", ".env");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf-8").split("\n").forEach(line => {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, "$1");
  });
}

const { CosmosClient } = await import("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
const container = client.database("devcraft").container("main");

const GITHUB_SUBMISSION = { type: "github", instructions: "Push your code to a GitHub repository and submit the repo link for review." };
const QUIZ_SUBMISSION = { type: "platform", instructions: "Complete the quiz on the platform. Your score is recorded automatically." };

const { resources: paths } = await container.items.query({
  query: "SELECT * FROM c WHERE c.entityType = 'careerPath'"
}).fetchAll();

console.log(`Found ${paths.length} career paths. Updating submission fields...`);

let updated = 0;
for (const path of paths) {
  let changed = false;
  if (path.projects) {
    for (const project of path.projects) {
      if (!project.submission) {
        project.submission = project.type === "quiz" ? { ...QUIZ_SUBMISSION } : { ...GITHUB_SUBMISSION };
        changed = true;
      }
    }
  }
  if (changed) {
    await container.items.upsert(path);
    updated++;
    console.log(`  ✓ ${path.title}`);
  }
}

console.log(`\nDone! ${updated} career paths updated with submission fields.`);
