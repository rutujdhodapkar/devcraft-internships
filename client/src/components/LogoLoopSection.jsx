import { useEffect, useState } from "react";
import LogoLoop from "./LogoLoop";

const DEFAULT_LOGOS = [
  { src: "https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg", alt: "Partner", title: "Partner 1" },
];

const FALLBACK_SECTION = {
  enabled: true,
  heading: "Trusted by Students Across the Globe",
  subheading: "Join thousands of learners who've levelled up with DEV/CRAFT",
  logos: [
    {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/1200px-Google_2015_logo.svg.png",
      alt: "Google",
      title: "Google",
      href: "https://google.com",
    },
    {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/1200px-Microsoft_logo.svg.png",
      alt: "Microsoft",
      title: "Microsoft",
      href: "https://microsoft.com",
    },
    {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Meta-Logo.png/1200px-Meta-Logo.png",
      alt: "Meta",
      title: "Meta",
      href: "https://meta.com",
    },
    {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/800px-Apple_logo_black.svg.png",
      alt: "Apple",
      title: "Apple",
      href: "https://apple.com",
    },
    {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Notion-logo.svg/2048px-Notion-logo.svg.png",
      alt: "Notion",
      title: "Notion",
      href: "https://notion.so",
    },
    {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Visual_Studio_Code_1.35_icon.svg/2048px-Visual_Studio_Code_1.35_icon.svg.png",
      alt: "VS Code",
      title: "VS Code",
      href: "https://code.visualstudio.com",
    },
  ],
  speed: 90,
  logoHeight: 40,
  gap: 64,
};

export default function LogoLoopSection() {
  const [section, setSection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("../services/data")
      .then(({ fetchLogoLoopContent }) => fetchLogoLoopContent())
      .then((data) => {
        if (data) {
          setSection(data);
        } else {
          setSection(FALLBACK_SECTION);
        }
      })
      .catch(() => setSection(FALLBACK_SECTION))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const cfg = section || FALLBACK_SECTION;

  // Don't render if explicitly disabled
  if (cfg.enabled === false) return null;

  const logos = Array.isArray(cfg.logos) && cfg.logos.length > 0 ? cfg.logos : FALLBACK_SECTION.logos;

  return (
    <section
      style={{
        padding: "4rem 0 3rem",
        background: "#fff",
        borderTop: "1px solid #f0f0f0",
        overflow: "hidden",
      }}
      aria-label="Partners and trusted brands"
    >
      {/* Heading */}
      {(cfg.heading || cfg.subheading) && (
        <div
          style={{
            textAlign: "center",
            marginBottom: "2.5rem",
            padding: "0 1rem",
          }}
        >
          {cfg.heading && (
            <p
              style={{
                fontSize: "clamp(1rem, 2.5vw, 1.35rem)",
                fontWeight: 800,
                color: "#111",
                letterSpacing: "-0.01em",
                marginBottom: "0.4rem",
                textTransform: "uppercase",
              }}
            >
              {cfg.heading}
            </p>
          )}
          {cfg.subheading && (
            <p
              style={{
                fontSize: "clamp(0.85rem, 1.5vw, 1rem)",
                color: "#666",
                fontWeight: 400,
              }}
            >
              {cfg.subheading}
            </p>
          )}
        </div>
      )}

      {/* Logo Loop */}
      <div style={{ overflow: "hidden", width: "100%" }}>
        <LogoLoop
          logos={logos}
          speed={Number(cfg.speed) || 90}
          direction="left"
          logoHeight={Number(cfg.logoHeight) || 40}
          gap={Number(cfg.gap) || 64}
          hoverSpeed={0}
          fadeOut
          fadeOutColor="#ffffff"
          scaleOnHover
          ariaLabel={cfg.heading || "Partner logos"}
          style={{ padding: "0.5rem 0" }}
        />
      </div>
    </section>
  );
}
