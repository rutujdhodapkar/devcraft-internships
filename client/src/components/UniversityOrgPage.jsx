import React from "react";
import PartnerPortal from "./PartnerPortal";

export default function UniversityOrgPage({ onClose, user }) {
  return <PartnerPortal type="university" title="University & Organization" subtitle="Create and manage a structured DEV/CRAFT learning program." onClose={onClose} user={user} />;
}
