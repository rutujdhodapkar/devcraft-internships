import React, { useEffect, useState } from "react";
import { fetchCourses, courseEnroll } from "../services/data";
import { notify } from "../services/notify";
import { getDomainIconUrl } from "../utils/domainIcons";

const styles = {
  wrapper: { maxWidth: 1200, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" },
  header: { fontSize: "2rem", fontWeight: 900, textTransform: "uppercase", margin: "0 0 0.25rem" },
  sub: { fontSize: "1rem", color: "#666", margin: "0 0 2rem" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" },
  card: (free) => ({ border: "2px solid #000", background: free ? "#fafafa" : "#fffde7", padding: "1.5rem", display: "flex", flexDirection: "column", transition: "transform .15s" }),
  badge: (free) => ({ display: "inline-block", background: free ? "#4caf50" : "#f9a825", color: "#fff", fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.6rem", textTransform: "uppercase", marginBottom: "0.75rem" }),
  icon: { fontSize: "2rem", marginBottom: "0.5rem" },
  title: { fontSize: "1.2rem", fontWeight: 800, margin: "0 0 0.25rem" },
  desc: { fontSize: "0.85rem", color: "#555", margin: "0 0 1rem", flex: 1 },
  meta: { display: "flex", gap: "1rem", fontSize: "0.8rem", color: "#777", marginBottom: "1rem" },
  features: { listStyle: "none", padding: 0, margin: "0 0 1.25rem", fontSize: "0.85rem", lineHeight: 1.8 },
  btn: { background: "#000", color: "#fff", border: "none", padding: "0.75rem 1.5rem", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", fontSize: "0.85rem" },
  price: { fontSize: "1.5rem", fontWeight: 900, marginBottom: "1rem" },
};

export default function CourseCatalog({ user, userProfile, onEnroll }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(null);

  useEffect(() => { fetchCourses().then(setCourses).catch(() => {}).finally(() => setLoading(false)); }, []);

  const handleEnroll = async (course) => {
    if (!user) return notify("Please sign in to enroll.", "info");
    if (!userProfile?.phone) return notify("Complete your profile in Dashboard first.", "info");
    setEnrolling(course.id);
    try {
      const enr = await courseEnroll(course.id, {
        uid: user.uid, email: user.email, name: user.displayName || userProfile?.name,
        phone: userProfile?.phone, college: userProfile?.college,
        city: userProfile?.city, country: userProfile?.country,
      });
      notify("Enrolled successfully!", "success");
      if (onEnroll) onEnroll(enr);
    } catch (e) { notify(e.message, "error"); }
    setEnrolling(null);
  };

  if (loading) return <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>Loading courses...</div>;

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.header}>Courses</h1>
      <p style={styles.sub}>Build skills with structured courses. Free and paid programs with certificates.</p>
      {courses.length === 0 && <p style={{ textAlign: "center", color: "#888" }}>No courses available yet.</p>}
      <div style={styles.grid}>
        {courses.map(c => {
          const amount = Number(c.paymentAmount ?? c.price ?? 0);
          const free = amount <= 0;
          const timingLabel = c.paymentTiming === "start" ? "Pay before starting" : c.paymentTiming === "both" ? "Split payment" : "Pay after completion";
          return (
            <div key={c.id} style={styles.card(free)} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <span style={styles.badge(free)}>{free ? "Free" : timingLabel}</span>
              <img src={getDomainIconUrl(c)} alt="" width="52" height="52" style={{ ...styles.icon, width: "52px", height: "52px", objectFit: "contain" }} />
              <h2 style={styles.title}>{c.title}</h2>
              <p style={styles.desc}>{c.description}</p>
              <div style={styles.meta}>
                <span>⏱ {c.duration || "Self-paced"}</span>
                <span>{c.level || "All Levels"}</span>
              </div>
              <ul style={styles.features}>
                {(Array.isArray(c.features) ? c.features : []).map((f, i) => <li key={i} style={{ paddingLeft: "1.25rem", textIndent: "-1.25rem" }}>{f}</li>)}
              </ul>
              <div style={{ marginTop: "auto" }}>
                <div style={styles.price}>{free ? "Free" : `₹${amount}`}</div>
                <button style={styles.btn} onClick={() => handleEnroll(c)} disabled={enrolling === c.id}>
                  {enrolling === c.id ? "Enrolling..." : "Enroll Now"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
