import React from "react";
import McpUserDashboard from "./McpUserDashboard";

export default function McpDashboard({ onClose, user }) {
  return <McpUserDashboard user={user} onClose={onClose} />;
}
