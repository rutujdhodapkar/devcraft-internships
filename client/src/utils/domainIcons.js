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
