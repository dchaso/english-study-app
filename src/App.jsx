import { useState } from "react";

const SAMPLE_TEXT = `The concept of neuroplasticity has revolutionized our understanding of the human brain. For much of the twentieth century, scientists believed that the brain's structure was essentially fixed after childhood. However, research over the past few decades has demonstrated that the brain retains a remarkable capacity to reorganize itself throughout life.

Neuroplasticity refers to the brain's ability to form new neural connections in response to learning, experience, or injury. When we acquire a new skill—whether playing a musical instrument, learning a language, or mastering a sport—our brains physically change. Neurons that fire together wire together, as the neuroscientist Donald Hebb famously observed.

This discovery has profound implications for education and rehabilitation. Stroke patients, for instance, can relearn lost functions because undamaged regions of the brain can compensate for injured areas. Similarly, musicians who practice intensively develop larger neural representations in areas associated with finger movement and auditory processing.

The mechanisms underlying neuroplasticity include synaptic strengthening, the growth of new synapses, and even the generation of new neurons in certain brain regions—a process called neurogenesis. Environmental enrichment, physical exercise, and cognitive challenges all appear to promote these changes, while chronic stress and social isolation can impair them.`;

export default function App() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState("input"); // input | loading | study
  const [mode, setMode] = useState("comprehension"); // comprehension | vocabulary
  const [quizData, setQuizData] = useState(null);
  const [vocabData, setVocabData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [error, setError] = useState("");

  async function analyze() {
    if (text.trim().length < 100) {
      setError("テキストが短すぎます。100文字以上の英文を入力してください。");
      return;
    }
    setError("");
    setPhase("loading");
    setSubmitted(false);
    setAnswers({});
    setRevealed({});
    setScore(null);

    try {
      // Comprehension questions
      const compRes = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an English teacher. Given a text, generate exactly 4 multiple-choice comprehension questions. 
Respond ONLY with a JSON object, no markdown, no explanation. Format:
{"questions":[{"id":1,"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A"},...]}`,
          messages: [{ role: "user", content: `Text:\n${text}` }],
        }),
      });
      const compJson = await compRes.json();
      const compText = compJson.content.map((b) => b.text || "").join("");
      const comp = JSON.parse(compText.replace(/```json|```/g, "").trim());

      // Vocabulary
      const vocRes = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are an English vocabulary teacher. Extract 8 important words or phrases from the text that are worth studying.
Respond ONLY with a JSON object, no markdown. Format:
{"words":[{"word":"...","pronunciation":"...","meaning":"日本語の意味","example":"example sentence from the text or similar"},...]}`,
          messages: [{ role: "user", content: `Text:\n${text}` }],
        }),
      });
      const vocJson = await vocRes.json();
      const vocText = vocJson.content.map((b) => b.text || "").join("");
      const voc = JSON.parse(vocText.replace(/```json|```/g, "").trim());

      setQuizData(comp);
      setVocabData(voc);
      setPhase("study");
    } catch (e) {
      setError("解析中にエラーが発生しました。もう一度お試しください。");
      setPhase("input");
    }
  }

  function submitAnswers() {
    if (!quizData) return;
    let correct = 0;
    quizData.questions.forEach((q) => {
      if (answers[q.id]?.[0] === q.answer[0]) correct++;
    });
    setScore(correct);
    setSubmitted(true);
  }

  function reset() {
    setPhase("input");
    setQuizData(null);
    setVocabData(null);
    setAnswers({});
    setRevealed({});
    setSubmitted(false);
    setScore(null);
    setText("");
  }

  return (
    <div style={styles.root}>
      <style>{css}</style>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoMark}>E</span>
            <span style={styles.logoText}>ReadMaster</span>
          </div>
          {phase === "study" && (
            <button onClick={reset} style={styles.resetBtn}>
              ← 新しいテキスト
            </button>
          )}
        </div>
      </header>

      <main style={styles.main}>
        {/* INPUT PHASE */}
        {phase === "input" && (
          <div className="fade-in" style={styles.inputSection}>
            <div style={styles.titleBlock}>
              <h1 style={styles.h1}>英語長文学習アプリ</h1>
              <p style={styles.subtitle}>
                英文を貼り付けて、内容理解テストと語彙チェックを自動生成します
              </p>
            </div>

            <div style={styles.card}>
              <div style={styles.cardLabel}>英文テキストを入力</div>
              <textarea
                style={styles.textarea}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="ここに英文を貼り付けてください..."
                rows={12}
              />
              <div style={styles.textareaFooter}>
                <span style={styles.charCount}>{text.length} 文字</span>
                <button
                  onClick={() => setText(SAMPLE_TEXT)}
                  style={styles.sampleBtn}
                >
                  サンプルテキストを使う
                </button>
              </div>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <button onClick={analyze} style={styles.analyzeBtn} className="analyze-btn">
              <span>AIで解析・問題生成</span>
              <span style={styles.btnArrow}>→</span>
            </button>
          </div>
        )}

        {/* LOADING */}
        {phase === "loading" && (
          <div style={styles.loadingWrap} className="fade-in">
            <div style={styles.loader} className="spin" />
            <p style={styles.loadingText}>AIが問題を生成しています...</p>
          </div>
        )}

        {/* STUDY PHASE */}
        {phase === "study" && (
          <div className="fade-in">
            {/* Mode Tabs */}
            <div style={styles.tabs}>
              <button
                style={{ ...styles.tab, ...(mode === "comprehension" ? styles.tabActive : {}) }}
                onClick={() => { setMode("comprehension"); setSubmitted(false); setAnswers({}); setScore(null); }}
              >
                📖 内容理解テスト
              </button>
              <button
                style={{ ...styles.tab, ...(mode === "vocabulary" ? styles.tabActive : {}) }}
                onClick={() => { setMode("vocabulary"); setRevealed({}); }}
              >
                📝 語彙チェック
              </button>
            </div>

            {/* COMPREHENSION */}
            {mode === "comprehension" && quizData && (
              <div>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.h2}>内容理解テスト</h2>
                  <p style={styles.sectionSub}>テキストを読んで4問に答えましょう</p>
                </div>

                {quizData.questions.map((q, qi) => {
                  const chosen = answers[q.id];
                  const isCorrect = submitted && chosen?.[0] === q.answer[0];
                  const isWrong = submitted && chosen && chosen[0] !== q.answer[0];
                  return (
                    <div key={q.id} style={{ ...styles.questionCard, ...(submitted ? (isCorrect ? styles.qCorrect : isWrong ? styles.qWrong : {}) : {}) }}>
                      <div style={styles.qNum}>Q{qi + 1}</div>
                      <p style={styles.qText}>{q.question}</p>
                      <div style={styles.options}>
                        {q.options.map((opt) => {
                          const sel = answers[q.id] === opt;
                          const isAns = submitted && opt[0] === q.answer[0];
                          return (
                            <button
                              key={opt}
                              onClick={() => !submitted && setAnswers({ ...answers, [q.id]: opt })}
                              style={{
                                ...styles.optBtn,
                                ...(sel ? styles.optSelected : {}),
                                ...(isAns ? styles.optCorrect : {}),
                                ...(submitted && sel && !isAns ? styles.optWrong : {}),
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {submitted && (
                        <div style={styles.qResult}>
                          {isCorrect ? "✓ 正解！" : `✗ 不正解。正解は ${q.answer}`}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!submitted ? (
                  <button onClick={submitAnswers} style={styles.submitBtn}>
                    採点する
                  </button>
                ) : (
                  <div style={styles.scoreCard}>
                    <div style={styles.scoreBig}>{score} / {quizData.questions.length}</div>
                    <div style={styles.scoreMsg}>
                      {score === quizData.questions.length ? "🎉 全問正解！素晴らしい！" :
                       score >= quizData.questions.length / 2 ? "👍 よく理解できています！" :
                       "📚 もう一度テキストを読み直してみましょう"}
                    </div>
                    <button onClick={() => { setSubmitted(false); setAnswers({}); setScore(null); }} style={styles.retryBtn}>
                      もう一度挑戦
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* VOCABULARY */}
            {mode === "vocabulary" && vocabData && (
              <div>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.h2}>語彙チェック</h2>
                  <p style={styles.sectionSub}>カードをクリックして意味を確認しましょう</p>
                </div>
                <div style={styles.vocabGrid}>
                  {vocabData.words.map((w, i) => (
                    <div
                      key={i}
                      onClick={() => setRevealed({ ...revealed, [i]: !revealed[i] })}
                      style={{ ...styles.vocabCard, ...(revealed[i] ? styles.vocabCardFlipped : {}) }}
                      className="vocab-card"
                    >
                      <div style={styles.vocabWord}>{w.word}</div>
                      <div style={styles.vocabPron}>{w.pronunciation}</div>
                      {revealed[i] ? (
                        <div style={styles.vocabMeaning}>
                          <div style={styles.vocabJp}>{w.meaning}</div>
                          <div style={styles.vocabEx}>"{w.example}"</div>
                        </div>
                      ) : (
                        <div style={styles.vocabHint}>タップして意味を確認</div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={styles.vocabStats}>
                  確認済み: {Object.values(revealed).filter(Boolean).length} / {vocabData.words.length}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0f1117",
    color: "#e8e4d9",
    fontFamily: "'Georgia', 'Times New Roman', serif",
  },
  header: {
    borderBottom: "1px solid #2a2d3a",
    padding: "0 24px",
    background: "#0f1117",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    maxWidth: 760,
    margin: "0 auto",
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoMark: {
    width: 32, height: 32, background: "#c8a96e",
    borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, fontWeight: "bold", color: "#0f1117",
    fontFamily: "serif", lineHeight: "32px", textAlign: "center",
  },
  logoText: { fontSize: 18, fontWeight: "600", letterSpacing: "0.05em", color: "#e8e4d9" },
  resetBtn: {
    background: "none", border: "1px solid #3a3d4a", color: "#9a968e",
    padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 14,
    transition: "all 0.2s",
  },
  main: { maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" },
  inputSection: { display: "flex", flexDirection: "column", gap: 28 },
  titleBlock: { textAlign: "center", paddingTop: 20 },
  h1: { fontSize: 32, fontWeight: "400", letterSpacing: "0.02em", margin: 0, color: "#e8e4d9" },
  subtitle: { color: "#6e6a61", marginTop: 10, fontSize: 16, lineHeight: 1.6 },
  card: {
    background: "#181b24", border: "1px solid #2a2d3a", borderRadius: 12,
    padding: 24, display: "flex", flexDirection: "column", gap: 12,
  },
  cardLabel: { fontSize: 12, letterSpacing: "0.1em", color: "#c8a96e", textTransform: "uppercase" },
  textarea: {
    background: "#0f1117", border: "1px solid #2a2d3a", borderRadius: 8,
    color: "#e8e4d9", padding: 16, fontSize: 15, lineHeight: 1.8, resize: "vertical",
    fontFamily: "inherit", outline: "none",
    transition: "border-color 0.2s",
  },
  textareaFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  charCount: { fontSize: 13, color: "#4a4d5a" },
  sampleBtn: {
    background: "none", border: "none", color: "#c8a96e", cursor: "pointer",
    fontSize: 13, textDecoration: "underline",
  },
  errorBox: {
    background: "#2a1a1a", border: "1px solid #5a2a2a", borderRadius: 8,
    padding: "12px 16px", color: "#e07070", fontSize: 14,
  },
  analyzeBtn: {
    background: "#c8a96e", border: "none", color: "#0f1117",
    padding: "16px 32px", borderRadius: 8, fontSize: 16, fontWeight: "600",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    gap: 10, alignSelf: "center", letterSpacing: "0.03em", transition: "all 0.2s",
    fontFamily: "inherit",
  },
  btnArrow: { fontSize: 18 },
  loadingWrap: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", minHeight: 300, gap: 20,
  },
  loader: {
    width: 48, height: 48, border: "3px solid #2a2d3a",
    borderTop: "3px solid #c8a96e", borderRadius: "50%",
  },
  loadingText: { color: "#6e6a61", fontSize: 16 },
  tabs: { display: "flex", gap: 4, marginBottom: 32, borderBottom: "1px solid #2a2d3a", paddingBottom: 0 },
  tab: {
    background: "none", border: "none", borderBottom: "2px solid transparent",
    color: "#6e6a61", padding: "12px 20px", cursor: "pointer", fontSize: 15,
    fontFamily: "inherit", transition: "all 0.2s", marginBottom: -1,
  },
  tabActive: { color: "#c8a96e", borderBottomColor: "#c8a96e" },
  sectionHeader: { marginBottom: 24 },
  h2: { fontSize: 22, fontWeight: "400", margin: 0, color: "#e8e4d9" },
  sectionSub: { color: "#6e6a61", marginTop: 6, fontSize: 14 },
  questionCard: {
    background: "#181b24", border: "1px solid #2a2d3a", borderRadius: 12,
    padding: 24, marginBottom: 16, transition: "border-color 0.3s",
  },
  qCorrect: { borderColor: "#3a6e4a" },
  qWrong: { borderColor: "#6e3a3a" },
  qNum: { fontSize: 11, letterSpacing: "0.1em", color: "#c8a96e", textTransform: "uppercase", marginBottom: 8 },
  qText: { fontSize: 16, lineHeight: 1.7, margin: "0 0 16px", color: "#e8e4d9" },
  options: { display: "flex", flexDirection: "column", gap: 8 },
  optBtn: {
    background: "#0f1117", border: "1px solid #2a2d3a", color: "#9a968e",
    padding: "10px 16px", borderRadius: 8, cursor: "pointer", textAlign: "left",
    fontSize: 14, lineHeight: 1.5, transition: "all 0.15s", fontFamily: "inherit",
  },
  optSelected: { borderColor: "#c8a96e", color: "#c8a96e", background: "#1f1c14" },
  optCorrect: { borderColor: "#4a9e6a", color: "#4a9e6a", background: "#0f1f16" },
  optWrong: { borderColor: "#9e4a4a", color: "#9e4a4a", background: "#1f0f0f" },
  qResult: { marginTop: 12, fontSize: 13, color: "#9a968e" },
  submitBtn: {
    width: "100%", background: "#c8a96e", border: "none", color: "#0f1117",
    padding: "14px", borderRadius: 8, fontSize: 16, fontWeight: "600",
    cursor: "pointer", marginTop: 8, fontFamily: "inherit", transition: "all 0.2s",
  },
  scoreCard: {
    background: "#181b24", border: "1px solid #2a2d3a", borderRadius: 12,
    padding: 32, textAlign: "center", marginTop: 16,
  },
  scoreBig: { fontSize: 48, fontWeight: "300", color: "#c8a96e", margin: "0 0 8px" },
  scoreMsg: { fontSize: 16, color: "#9a968e", marginBottom: 24 },
  retryBtn: {
    background: "none", border: "1px solid #3a3d4a", color: "#9a968e",
    padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "inherit",
  },
  vocabGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16,
  },
  vocabCard: {
    background: "#181b24", border: "1px solid #2a2d3a", borderRadius: 12,
    padding: 24, cursor: "pointer", transition: "all 0.2s", minHeight: 130,
  },
  vocabCardFlipped: { border: "1px solid #3a4a3a", background: "#141c14" },
  vocabWord: { fontSize: 22, fontWeight: "500", color: "#e8e4d9", marginBottom: 4 },
  vocabPron: { fontSize: 13, color: "#6e6a61", marginBottom: 12, fontFamily: "monospace" },
  vocabHint: { fontSize: 13, color: "#3a3d4a", fontStyle: "italic" },
  vocabMeaning: {},
  vocabJp: { fontSize: 18, color: "#c8a96e", fontWeight: "500", marginBottom: 8 },
  vocabEx: { fontSize: 13, color: "#6e6a61", lineHeight: 1.6, fontStyle: "italic" },
  vocabStats: { textAlign: "center", marginTop: 20, color: "#6e6a61", fontSize: 14 },
};

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .fade-in { animation: fadeIn 0.4s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .analyze-btn:hover { background: #d4b87a !important; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(200,169,110,0.3); }
  .vocab-card:hover { border-color: #c8a96e !important; transform: translateY(-2px); }
  textarea:focus { border-color: #c8a96e !important; }
`;
