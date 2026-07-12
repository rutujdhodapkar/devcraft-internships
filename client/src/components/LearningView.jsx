import React, { useEffect, useState } from "react";
import { notify } from "../services/notify";

const s = {
  wrap: { maxWidth: 1000, margin: "0 auto", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif" },
  top: { display: "flex", gap: "1rem", marginBottom: "2rem", alignItems: "flex-start" },
  backBtn: { background: "none", border: "2px solid #000", padding: "0.4rem 1rem", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem" },
  title: { fontSize: "1.5rem", fontWeight: 900, margin: 0, flex: 1 },
  badge: (green) => ({ display: "inline-block", background: green ? "#4caf50" : "#f9a825", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "0.15rem 0.5rem", marginLeft: "0.5rem" }),
  layout: { display: "grid", gridTemplateColumns: "280px 1fr", gap: "2rem" },
  sidebar: { border: "2px solid #000", padding: "1rem", background: "#fafafa", alignSelf: "start" },
  blockBtn: (active, done) => ({ display: "block", width: "100%", textAlign: "left", background: active ? "#000" : done ? "#e8f5e9" : "none", color: active ? "#fff" : "#222", border: "none", padding: "0.5rem 0.75rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: active ? 700 : 400, marginBottom: "0.25rem" }),
  btn: { background: "#000", color: "#fff", border: "none", padding: "0.6rem 1.2rem", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", marginTop: "1rem" },
  disabledBtn: { background: "#ccc", color: "#888", border: "none", padding: "0.6rem 1.2rem", fontWeight: 700, cursor: "not-allowed", fontSize: "0.85rem", marginTop: "1rem" },
  contentBox: { border: "2px solid #000", padding: "1.5rem", minHeight: 300, background: "#fff" },
  optBtn: (sel) => ({ display: "block", width: "100%", textAlign: "left", background: sel ? "#000" : "#f5f5f5", color: sel ? "#fff" : "#222", border: "1px solid #ccc", padding: "0.6rem 1rem", cursor: "pointer", marginBottom: "0.3rem", fontSize: "0.85rem" }),
  resultBox: (pass) => ({ border: `3px solid ${pass ? "#4caf50" : "#f44336"}`, padding: "1.5rem", textAlign: "center", background: pass ? "#e8f5e9" : "#ffebee", marginTop: "1rem" }),
  certLink: { display: "inline-block", marginTop: "1rem", background: "#4caf50", color: "#fff", padding: "0.75rem 2rem", fontWeight: 700, textDecoration: "none", fontSize: "1rem" },
};

export default function LearningView({ enrollment, userId, onBack, careerPaths }) {
  const [content, setContent] = useState(null);
  const [activeBlock, setActiveBlock] = useState(0);
  const [completedBlocks, setCompletedBlocks] = useState([]);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [certAllowed, setCertAllowed] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizPassed, setQuizPassed] = useState(null);

  useEffect(() => {
    const cid = enrollment.courseId || enrollment.domainId;
    const cp = careerPaths ? careerPaths.find(p => p.id === cid || p.title === enrollment.domain) : null;
    if (cp?.content) {
      setContent(cp.content);
    } else {
      import("../services/data").then(({ fetchCareerPaths }) =>
        fetchCareerPaths().then(r => {
          const p = (r.paths || r || []).find(x => x.id === cid || x.title === enrollment.domain);
          if (p?.content) setContent(p.content);
        }).catch(() => {})
      );
    }
    if (enrollment.id) {
      const p = enrollment.progress || {};
      setCompletedBlocks(p.completedBlocks || []);
      setCertAllowed(enrollment.allowedCertificate === "yes");
      setCourseCompleted(p.certificateEarned || enrollment.status === "Completed");
    }
  }, [enrollment, careerPaths]);

  const isBlockDone = (bi) => completedBlocks.includes(bi);
  const allBlocksDone = content && completedBlocks.length === content.length;

  const markBlockComplete = async (bi) => {
    const newCompleted = [...new Set([...completedBlocks, bi])];
    setCompletedBlocks(newCompleted);
    try {
      const { saveCourseProgress } = await import("../services/data");
      if (enrollment.id) {
        const updated = await saveCourseProgress(enrollment.id, newCompleted);
        setCertAllowed(updated?.allowedCertificate === "yes");
        setCourseCompleted(updated?.status === "Completed" || newCompleted.length === content.length);
      }
      if (newCompleted.length === content.length) {
        setCourseCompleted(true);
        if (enrollment.paymentAmount === 0) setCertAllowed(true);
        notify("Course completed!", "success");
      } else {
        if (bi + 1 < content.length) setActiveBlock(bi + 1);
      }
    } catch (e) { notify("Failed to save progress", "error"); }
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizPassed(null);
  };

  const selectAnswer = (qi, val) => setQuizAnswers(prev => ({ ...prev, [qi]: val }));

  const submitBlockQuiz = async (bi) => {
    const block = content[bi];
    if (!block?.quiz?.questions) return;
    const questions = block.quiz.questions;
    let correct = 0;
    questions.forEach((q, qi) => {
      if (quizAnswers[qi] === q.correctIndex) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= (block.quiz.passingScore || 70);
    setQuizSubmitted(true);
    setQuizPassed(passed);
    if (passed) markBlockComplete(bi);
  };

  const block = content?.[activeBlock];
  const enrolledName = enrollment.courseId || enrollment.domainId || "";

  return (
    <div style={s.wrap}>
      <div style={s.top}>
        <button style={s.backBtn} onClick={onBack}>Back</button>
        <h1 style={s.title}>{enrolledName.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())} {courseCompleted && <span style={s.badge(true)}>Completed</span>}</h1>
      </div>
      {courseCompleted && allBlocksDone && (
        <div style={s.resultBox(true)}>
          <h2 style={{ margin: 0 }}>Course Completed!</h2>
          <p>You have completed all content blocks.</p>
          {certAllowed && <a style={s.certLink} href={`/certificate/${enrollment.id}/Certificate`} target="_blank" rel="noopener noreferrer">View Certificate</a>}
          {enrollment.paymentAmount > 0 && enrollment.paymentStatus !== "paid" && <p style={{ marginTop: "1rem", fontSize: "0.85rem" }}>Complete payment to receive your certificate.</p>}
        </div>
      )}
      {content && content.length > 0 && (
        <div style={s.layout}>
          <div style={s.sidebar}>
            {content.map((b, bi) => (
              <div key={bi}>
                <button style={s.blockBtn(activeBlock === bi, isBlockDone(bi))}
                  onClick={() => { setActiveBlock(bi); setQuizAnswers({}); setQuizSubmitted(false); setQuizPassed(null); }}>
                  {isBlockDone(bi) ? "Done " : ""}{b.title || `Block ${bi + 1}`}
                </button>
              </div>
            ))}
          </div>
          <div>
            {block && (
              <div style={s.contentBox}>
                <h2 style={{ margin: "0 0 1rem" }}>{block.title || `Block ${activeBlock + 1}`}</h2>
                <div
                  ref={(el) => {
                    if (el) {
                      el.querySelectorAll('[data-action="mark-complete"]').forEach(btn => {
                        btn.onclick = (e) => { e.preventDefault(); markBlockComplete(activeBlock); };
                      });
                      el.querySelectorAll('[data-action="quiz-submit"]').forEach(btn => {
                        btn.onclick = (e) => { e.preventDefault(); submitBlockQuiz(activeBlock); };
                      });
                    }
                  }}
                  style={{ lineHeight: 1.8, fontSize: "0.95rem" }}
                  dangerouslySetInnerHTML={{ __html: (block.html || "").replace("[quiz]", "") }}
                />
                {((block.html || "").includes("[quiz]") || block?.quiz?.questions?.length > 0) && !isBlockDone(activeBlock) && (
                  <div style={(block.html || "").includes("[quiz]") ? {} : { borderTop: "2px solid #ff9800", marginTop: "1.5rem", paddingTop: "1rem" }}>
                    {!(block.html || "").includes("[quiz]") && <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>{block.quiz.title || "Quiz"}</h3>}
                    {!quizSubmitted ? (
                      <>
                        {(block.quiz?.questions || []).map((q, qi) => (
                          <div key={qi} style={{ marginBottom: "1rem" }}>
                            <p style={{ fontWeight: 700, margin: "0 0 0.5rem" }}>{qi + 1}. {q.question}</p>
                            {(q.options || []).map((opt, oi) => (
                              <button key={oi} style={s.optBtn(quizAnswers[qi] === oi)}
                                onClick={() => selectAnswer(qi, oi)}>
                                {String.fromCharCode(65 + oi)}. {opt}
                              </button>
                            ))}
                          </div>
                        ))}
                        <button style={Object.keys(quizAnswers).length === (block.quiz?.questions || []).length ? s.btn : s.disabledBtn}
                          disabled={Object.keys(quizAnswers).length < (block.quiz?.questions || []).length}
                          onClick={() => submitBlockQuiz(activeBlock)}>
                          Submit
                        </button>
                      </>
                    ) : (
                      <div style={s.resultBox(quizPassed)}>
                        <h3 style={{ margin: 0 }}>{quizPassed ? "Passed!" : "Not Passed"}</h3>
                        {!quizPassed && <button style={s.btn} onClick={() => { setQuizSubmitted(false); setQuizPassed(null); setQuizAnswers({}); }}>Try Again</button>}
                      </div>
                    )}
                  </div>
                )}
                {isBlockDone(activeBlock) ? (
                  <p style={{ marginTop: "1rem", fontWeight: 700, color: "#4caf50" }}>Completed</p>
                ) : (
                  <button style={s.btn} onClick={() => markBlockComplete(activeBlock)}>
                    {activeBlock + 1 === content.length ? "Complete Course" : "Mark as Completed"}
                  </button>
                )}
              </div>
            )}
            {!block && <p style={{ color: "#888", textAlign: "center", padding: "3rem" }}>{content ? "Select a block from the sidebar" : "Loading content..."}</p>}
          </div>
        </div>
      )}
      {(!content || content.length === 0) && <p style={{ color: "#888", textAlign: "center", padding: "3rem" }}>No content available for this course.</p>}
    </div>
  );
}
