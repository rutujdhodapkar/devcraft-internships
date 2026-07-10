import React from "react";
import PartnerPortal from "./PartnerPortal";

export default function McpDashboard({ onClose, user }) {
  return <PartnerPortal type="mcp" title="MCP & API" subtitle="Manage your approved integration workspace, catalogue, templates, and team." onClose={onClose} user={user} />;
}
