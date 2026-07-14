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

const idIconMap = {
  path_web: "development.png",
  path_python: "python.png",
  path_java: "java.png",
  path_cpp: "c-programming.png",
  path_data_science: "data-configuration.png",
  path_data_analysis: "data-analysis.png",
  path_ml: "machine-learning.png",
  path_ai: "artificial-intelligence.png",
  path_uiux: "design.png",
  path_appdev: "android-os.png",
  path_cloud: "cloud.png",
  path_cybersec: "cyber-security.png",
  path_fullstack: "code.png",
  path_devops: "devops.png",
  path_db: "database.png",
  path_blockchain: "blockchain.png",
  path_digital_mkt: "business.png",
};

export function getDomainIconUrl(domain) {
  if (domain?.iconUrl) return domain.iconUrl;

  const domainId = domain?.id;
  if (domainId && idIconMap[domainId]) {
    return `${PULSAR_COLOR_BASE}${idIconMap[domainId]}`;
  }

  const label = typeof domain === "string"
    ? domain
    : `${domain?.title || ""} ${domain?.name || ""} ${domain?.category || ""}`;
  const match = iconByKeyword.find(([pattern]) => pattern.test(label.toLowerCase()));
  return `${PULSAR_COLOR_BASE}${match?.[1] || "development.png"}`;
}

const COLORS = ["#e74c3c","#3498db","#2ecc71","#f39c12","#9b59b6","#1abc9c","#e67e22","#34495e"];

export function onIconError(e, domain) {
  if (e.target.dataset.fallback) return;
  e.target.dataset.fallback = "1";
  const label = typeof domain === "string" ? domain : (domain?.title || domain?.name || domain?.id || "");
  const char = label.trim().charAt(0).toUpperCase() || "?";
  const color = COLORS[char.charCodeAt(0) % COLORS.length];
  e.target.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="16" fill="${color}"/><text x="48" y="48" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-size="40" font-weight="700" fill="#fff">${char}</text></svg>`)}`;
}
