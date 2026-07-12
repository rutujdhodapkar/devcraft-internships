const PULSAR_COLOR_BASE = "https://img.icons8.com/pulsar-color/96w/";

const iconByKeyword = [
  [/cyber|security|ethical.?hack|network/, "cyber-security.png"],
  [/data|analytics|database|sql|machine.?learn/, "database.png"],
  [/artificial|\bai\b|intelligence/, "artificial-intelligence.png"],
  [/ui|ux|design|graphic/, "design.png"],
  [/cloud|devops|aws|azure/, "cloud.png"],
  [/android|mobile|app.?development/, "android-os.png"],
  [/python/, "python.png"],
  [/business|management|finance|marketing|sales|hr/, "business.png"],
  [/web|frontend|backend|full.?stack|software|programming|coding|java|react/, "development.png"],
];

/** Returns a verified Icons8 Pulsar Color icon, never a stored emoji. */
export function getDomainIconUrl(domain) {
  const label = typeof domain === "string"
    ? domain
    : `${domain?.title || ""} ${domain?.name || ""} ${domain?.category || ""}`;
  const match = iconByKeyword.find(([pattern]) => pattern.test(label.toLowerCase()));
  return `${PULSAR_COLOR_BASE}${match?.[1] || "development.png"}`;
}
