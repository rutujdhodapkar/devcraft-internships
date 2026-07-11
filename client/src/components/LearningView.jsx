import React, { useEffect, useState } from "react";
import { fetchCourseContent, markLessonComplete, submitCourseQuiz, fetchUserEnrollments, allowCertificate } from "../services/data";
import { notify } from "../services/notify";

const s = {
  wrap: { maxWidth: 1000, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" },
  top: { display: "flex", gap: "1rem", marginBottom: "2rem", alignItems: "flex-start" },
  backBtn: { background: "none", border: "2px solid #000", padding: "0.4rem 1rem", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" },
  title: { fontSize: "1.5rem", fontWeight: 900, margin: 0, flex: 1 },
  badge: (green) => ({ display: "inline-block", background: green ? "#4caf50" : "#f9a825", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.5rem", marginLeft: "0.5rem" }),
  layout: { display: "grid", gridTemplateColumns: "280px 1fr", gap: "2rem" },
  sidebar: { border: "2px solid #000", padding: "1rem", background: "#fafafa", alignSelf: "start" },
  modTitle: { fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", margin: "1rem 0 0.5rem" },
  lesson: (active, done) => ({ display: "block", width: "100%", textAlign: "left", background: active ? "#000" : done ? "#e8f5e9" : "none", color: active ? "#fff" : "#222", border: "none", padding: "0.5rem 0.75rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: active ? 700 : 400, marginBottom: "0.25rem" }),
  doneMark: { marginRight: "0.4rem", color: "#4caf50" },
  btn: { background: "#000", color: "#fff", border: "none", padding: "0.6rem 1.2rem", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", marginTop: "1rem" },
  disabledBtn: { background: "#ccc", color: "#888", border: "none", padding: "0.6rem 1.2rem", fontWeight: 700, cursor: "not-allowed", fontSize: "0.85rem", marginTop: "1rem" },
  contentBox: { border: "2px solid #000", padding: "1.5rem", minHeight: 300, background: "#fff" },
  quizQ: { marginBottom: "1.5rem" },
  optBtn: (sel) => ({ display: "block", width: "100%", textAlign: "left", background: sel ? "#000" : "#f5f5f5", color: sel ? "#fff" : "#222", border: "1px solid #ccc", padding: "0.6rem 1rem", cursor: "pointer", marginBottom: "0.3rem", fontSize: "0.85rem" }),
  resultBox: (pass) => ({ border: `3px solid ${pass ? "#4caf50" : "#f44336"}`, padding: "1.5rem", textAlign: "center", background: pass ? "#e8f5e9" : "#ffebee", marginTop: "1rem" }),
  certLink: { display: "inline-block", marginTop: "1rem", background: "#4caf50", color: "#fff", padding: "0.75rem 2rem", fontWeight: 700, textDecoration: "none", fontSize: "1rem" },
};

export default function LearningView({ enrollment, userId, onBack }) {
  const [content, setContent] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [completed, setCompleted] = useState({ lessons: [], modules: [] });
  const [quizMode, setQuizMode] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [certAllowed, setCertAllowed] = useState(false);
  const [existingEnrollments, setExistingEnrollments] = useState([]);

  useEffect(() => {
    const cid = enrollment.courseId;
    fetchCourseContent(cid).then(c => {
      if (c) {
        setContent(c);
        setActiveModule(0);
        if (c.modules?.[0]?.lessons?.length > 0) setActiveLesson(0);
      }
    }).catch(() => notify("Failed to load course content", "error"));
    if (enrollment.id) {
      const p = enrollment.progress || {};
      setCompleted({ lessons: p.completedLessons || [], modules: p.completedModules || [] });
      setCertAllowed(enrollment.allowedCertificate === "yes");
      setCourseCompleted(p.certificateEarned || enrollment.status === "Completed");
    }
  }, [enrollment]);

  const isLessonDone = (mi, li) => completed.lessons.includes(`${mi}-${li}`);
  const isModuleDone = (mi) => completed.modules.includes(mi);

  const handleMarkComplete = async () => {
    if (activeModule === null || activeLesson === null) return;
    try {
      await markLessonComplete(enrollment.id, activeModule, activeLesson);
      setCompleted(prev => ({ ...prev, lessons: [...new Set([...prev.lessons, `${activeModule}-${activeLesson}`])] }));
      notify("Lesson completed!", "success");
    } catch (e) { notify(e.message, "error"); }
  };

  const startQuiz = () => {
    setQuizMode(true);
    setQuizAnswers({});
    setQuizResult(null);
  };

  const selectQuizAnswer = (qi, val) => {
    setQuizAnswers(prev => ({ ...prev, [qi]: val }));
  };

  const submitQuiz = async () => {
    try {
      const result = await submitCourseQuiz(enrollment.id, activeModule,
        Object.entries(quizAnswers).map(([qi, answer]) => ({ questionIdx: parseInt(qi), answer: String(answer) }))
      );
      setQuizResult(result);
      if (result.passed) {
        setCompleted(prev => ({ ...prev, modules: [...new Set([...prev.modules, activeModule])] }));
      }
      if (result.courseCompleted) {
        setCourseCompleted(true);
        if (enrollment.paymentAmount === 0) {
          setCertAllowed(true);
        }
      }
      notify(result.passed ? "Quiz passed!" : "Quiz not passed. Try again.", result.passed ? "success" : "error");
    } catch (e) { notify(e.message, "error"); }
  };

  const mod = content?.modules?.[activeModule];
  const lesson = mod?.lessons?.[activeLesson];

  return (
    <div style={s.wrap}>
      <div style={s.top}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <h1 style={s.title}>{content?.title || enrollment.courseId} {courseCompleted && <span style={s.badge(true)}>Completed</span>}</h1>
      </div>
      {courseCompleted && <div style={s.resultBox(true)}>
        <h2 style={{ margin: 0 }}>🎉 Course Completed!</h2>
        <p>You have completed all modules.</p>
        {certAllowed && <a style={s.certLink} href={`/certificate/${enrollment.id}/Certificate`} target="_blank">View Certificate</a>}
        {enrollment.paymentAmount > 0 && enrollment.paymentStatus !== "paid" && <p style={{ marginTop: "1rem", fontSize: "0.85rem" }}>Complete payment to receive your certificate.</p>}
      </div>}
      <div style={s.layout}>
        <div style={s.sidebar}>
          {(content?.modules || []).map((m, mi) => (
            <div key={mi}>
              <div style={s.modTitle}>Module {mi + 1}{isModuleDone(mi) ? " ✅" : ""}</div>
              {m.lessons?.map((l, li) => (
                <button key={li} style={s.lesson(activeModule === mi && activeLesson === li, isLessonDone(mi, li))}
                  onClick={() => { setActiveModule(mi); setActiveLesson(li); setQuizMode(false); setQuizResult(null); }}>
                  {isLessonDone(mi, li) && <span style={s.doneMark}>✓</span>} {l.title}
                </button>
              ))}
              {m.quiz && <button style={{
                ...s.lesson(false, isModuleDone(mi)),
                background: isModuleDone(mi) ? "#e8f5e9" : "#fff8e1",
                fontWeight: 700, marginTop: "0.25rem",
              }} onClick={() => { setActiveModule(mi); setQuizMode(true); setQuizResult(null); }}>
                {isModuleDone(mi) ? "✓ " : "📝 "} Quiz
              </button>}
            </div>
          ))}
        </div>
        <div>
          {quizMode ? (
            <div style={s.contentBox}>
              {!quizResult ? (
                <>
                  <h2 style={{ margin: "0 0 1rem" }}>📝 {mod?.quiz?.title || "Quiz"}</h2>
                  <p style={{ fontSize: "0.85rem", color: "#666" }}>Passing score: {mod?.quiz?.passingScore || 70}%</p>
                  {(mod?.quiz?.questions || []).map((q, qi) => (
                    <div key={qi} style={s.quizQ}>
                      <p style={{ fontWeight: 700, margin: "0 0 0.5rem" }}>{qi + 1}. {q.question}</p>
                      {(q.options || []).map((opt, oi) => (
                        <button key={oi} style={s.optBtn(quizAnswers[qi] === oi)}
                          onClick={() => selectQuizAnswer(qi, oi)}>
                          {String.fromCharCode(65 + oi)}. {opt}
                        </button>
                      ))}
                    </div>
                  ))}
                  <button style={Object.keys(quizAnswers).length === (mod?.quiz?.questions || []).length ? s.btn : s.disabledBtn}
                    disabled={Object.keys(quizAnswers).length < (mod?.quiz?.questions || []).length} onClick={submitQuiz}>
                    Submit Quiz
                  </button>
                </>
              ) : (
                <div style={s.resultBox(quizResult.passed)}>
                  <h2 style={{ margin: 0, fontSize: "2rem" }}>{quizResult.passed ? "🎉 Passed!" : "😔 Not Passed"}</h2>
                  <p style={{ fontSize: "1.25rem", margin: "0.5rem 0" }}>Score: {quizResult.score}%</p>
                  <p>Correct: {(quizResult.results || []).filter(r => r.correct).length} / {(quizResult.results || []).length}</p>
                  {!quizResult.passed && <button style={s.btn} onClick={() => { setQuizMode(false); setQuizResult(null); }}>Review Lessons</button>}
                  {quizResult.courseCompleted && <p style={{ marginTop: "1rem", fontWeight: 700 }}>All modules passed! Course complete.</p>}
                </div>
              )}
            </div>
          ) : (
            <div style={s.contentBox}>
              {lesson ? (
                <>
                  <h2 style={{ margin: "0 0 0.5rem" }}>{lesson.title}</h2>
                  {lesson.duration && <p style={{ fontSize: "0.8rem", color: "#888", margin: "0 0 1rem" }}>⏱ {lesson.duration}</p>}
                  <div style={{ lineHeight: 1.8, fontSize: "0.95rem" }} dangerouslySetInnerHTML={{ __html: lesson.content }} />
                  <button style={isLessonDone(activeModule, activeLesson) ? { ...s.btn, background: "#4caf50" } : s.btn}
                    onClick={handleMarkComplete}>
                    {isLessonDone(activeModule, activeLesson) ? "✓ Completed" : "Mark as Complete"}
                  </button>
                  {mod?.quiz && isModuleDone(activeModule) ? (
                    <p style={{ marginTop: "1rem", fontWeight: 700, color: "#4caf50" }}>✅ Module quiz passed!</p>
                  ) : mod?.quiz ? (
                    <button style={s.btn} onClick={startQuiz}>📝 Take Module Quiz</button>
                  ) : null}
                </>
              ) : (
                <p style={{ color: "#888", textAlign: "center", padding: "3rem" }}>{content ? "Select a lesson from the sidebar" : "Loading course content..."}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
