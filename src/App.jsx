import { useState, useRef, useEffect } from "react";

const SAMPLE_TEXT = `The concept of neuroplasticity has revolutionized our understanding of the human brain. For much of the twentieth century, scientists believed that the brain's structure was essentially fixed after childhood. However, research over the past few decades has demonstrated that the brain retains a remarkable capacity to reorganize itself throughout life.

Neuroplasticity refers to the brain's ability to form new neural connections in response to learning, experience, or injury. When we acquire a new skill—whether playing a musical instrument, learning a language, or mastering a sport—our brains physically change. Neurons that fire together wire together, as the neuroscientist Donald Hebb famously observed.

This discovery has profound implications for education and rehabilitation. Stroke patients, for instance, can relearn lost functions because undamaged regions of the brain can compensate for injured areas. Similarly, musicians who practice intensively develop larger neural representations in areas associated with finger movement and auditory processing.

The mechanisms underlying neuroplasticity include synaptic strengthening, the growth of new synapses, and even the generation of new neurons in certain brain regions—a process called neurogenesis. Environmental enrichment, physical exercise, and cognitive challenges all appear to promote these changes, while chronic stress and social isolation can impair them.`;

const MODES = [
  { id: "comprehension", label: "内容理解", icon: "📖" },
  { id: "vocabulary", label: "語彙テスト", icon: "📝" },
  { id: "syntax", label: "構文テスト", icon: "🔤" },
];

export default function App() {
  const [inputMode, setInputMode] = useState("text");
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [phase, setPhase] = useState("input");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [activeMode, setActiveMode] = useState("comprehension");
  const [quizzes, setQuizzes] = useState({ comprehension: null, vocabulary: null, syntax: null });
  const [loadingMode, setLoadingMode] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [error, setError] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [showRanking, setShowRanking] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [roundCounts, setRoundCounts] = useState({});
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingScore, setPendingScore] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    const r = localStorage.getItem("rm_rankings");
    if (r) setRankings(JSON.parse(r));
    const n = localStorage.getItem("rm_name");
    if (n) setPlayerName(n);
    const rc = localStorage.getItem("rm_rounds");
    if (rc) setRoundCounts(JSON.parse(rc));
  }, []);

  function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target.result);
      setImageBase64(ev.target.result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  }

  async function callClaude(body) {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model: "claude-sonnet-4-20250514", max_tokens: 1500 }),
    });
    const data = await res.json();
    const raw = data.content.map((b) => b.text || "").join("");
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  }

  async function extractTextFromImage() {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
            { type: "text", text: "この画像に写っている英文テキストをすべて正確に抽出してください。英文のみを出力し、説明や補足は不要です。" }
          ]
        }]
      }),
    });
    const data = await res.json();
    return data.content.map((b) => b.text || "").join("").trim();
  }

  async function analyze() {
    setError("");
    let finalText = text;
    if (inputMode === "image") {
      if (!imageBase64) { setError("画像をアップロードしてください。"); return; }
      setPhase("loading");
      setLoadingMsg("画像からテキストを読み取っています...");
      try {
        finalText = await extractTextFromImage();
        setText(finalText);
      } catch {
        setError("画像の読み取りに失敗しました。"); setPhase("input"); return;
      }
    } else {
      if (text.trim().length < 100) { setError("100文字以上の英文を入力してください。"); return; }
      setPhase("loading");
    }
    setLoadingMsg("内容理解テストを生成中...");
    try {
      const comp = await callClaude({
        system: `You are an English teacher. Generate exactly 4 multiple-choice comprehension questions about the text.
Respond ONLY with JSON, no markdown:
{"questions":[{"id":1,"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A","explanation":"why this is correct in Japanese"},...]}`,
        messages: [{ role: "user", content: `Text:\n${finalText}` }],
      });
      setQuizzes((q) => ({ ...q, comprehension: comp }));
      setPhase("study");
      setActiveMode("comprehension");
    } catch {
      setError("問題生成に失敗しました。"); setPhase("input");
    }
  }

  async function loadMode(mode) {
    if (quizzes[mode]) { setActiveMode(mode); setAnswers({}); setSubmitted(false); setScore(null); return; }
    setLoadingMode(mode);
    try {
      let data;
      if (mode === "vocabulary") {
        data = await callClaude({
          system: `You are an English vocabulary teacher. Extract 8 important words from the text.
For each word, create a 4-option quiz (1 correct Japanese meaning + 3 plausible distractors).
Respond ONLY with JSON:
{"words":[{"id":1,"word":"...","pronunciation":"...","correct":"正しい日本語の意味","options":["意味A","意味B","意味C","意味D"],"example":"example sentence"},...]}
Make sure the correct answer appears in the options array. Shuffle so it's not always first.`,
          messages: [{ role: "user", content: `Text:\n${text}` }],
        });
      } else {
        data = await callClaude({
          system: `You are an English grammar teacher. Generate 4 syntax/grammar questions about the text.
Focus on: sentence structure, grammar patterns, word usage in context, clause types.
Respond ONLY with JSON:
{"questions":[{"id":1,"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":"A","explanation":"日本語で文法解説"},...]}`,
          messages: [{ role: "user", content: `Text:\n${text}` }],
        });
      }
      setQuizzes((q) => ({ ...q, [mode]: data }));
      setActiveMode(mode);
      setAnswers({});
      setSubmitted(false);
      setScore(null);
    } catch {
      setError("問題の生成に失敗しました。");
    }
    setLoadingMode(null);
  }

  function switchMode(mode) {
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    loadMode(mode);
  }

  function submit() {
    const quiz = quizzes[activeMode];
    const items = quiz.questions || quiz.words;
    let correct = 0;
    items.forEach((item) => {
      const ans = answers[item.id];
      if (!ans) return;
      if (activeMode === "vocabulary") {
        if (ans === item.correct) correct++;
      } else {
        if (ans[0] === item.answer[0]) correct++;
      }
    });
    const pct = Math.round((correct / items.length) * 100);
    setScore({ correct, total: items.length, pct });
    setSubmitted(true);
    const newRounds = { ...roundCounts, [activeMode]: (roundCounts[activeMode] || 0) + 1 };
    setRoundCounts(newRounds);
    localStorage.setItem("rm_rounds", JSON.stringify(newRounds));
    if (!playerName) {
      setPendingScore({ correct, total: items.length, pct, mode: activeMode });
      setShowNameModal(true);
    } else {
      saveRanking(playerName, pct, activeMode, newRounds[activeMode]);
    }
  }

  function saveRanking(name, pct, mode, rounds) {
    const entry = {
      name,
      score: pct,
      mode: MODES.find((m) => m.id === mode)?.label || mode,
      date: new Date().toLocaleDateString("ja-JP"),
      rounds: rounds || 1,
    };
    const newRankings = [...rankings, entry].sort((a, b) => b.score - a.score).slice(0, 50);
    setRankings(newRankings);
    localStorage.setItem("rm_rankings", JSON.stringify(newRankings));
  }

  function confirmName() {
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    setPlayerName(name);
    localStorage.setItem("rm_name", name);
    if (pendingScore) saveRanking(name, pendingScore.pct, pendingScore.mode, roundCounts[pendingScore.mode] || 1);
    setShowNameModal(false);
    setPendingScore(null);
  }

  function retry() { setAnswers({}); setSubmitted(false); setScore(null); }

  function reset() {
    setPhase("input"); setQuizzes({ comprehension: null, vocabulary: null, syntax: null });
    setAnswers({}); setSubmitted(false); setScore(null);
    setText(""); setImagePreview(null); setImageBase64(null);
    setActiveMode("comprehension"); setError("");
  }

  function renderQuiz() {
    const quiz = quizzes[activeMode];
    if (!quiz) return null;
    const items = quiz.questions || quiz.words;
    return (
      <div>
        {items.map((item, i) => {
          const chosen = answers[item.id];
          const isVocab = activeMode === "vocabulary";
          const correct = isVocab ? item.correct : item.answer;
          const isCorrect = submitted && (isVocab ? chosen === correct : chosen?.[0] === correct[0]);
          const isWrong = submitted && chosen && !isCorrect;
          return (
            <div key={item.id} style={{ ...S.qCard, ...(submitted ? (isCorrect ? S.qGood : isWrong ? S.qBad : {}) : {}) }}>
              <div style={S.qNum}>{isVocab ? "WORD" : `Q${i + 1}`}</div>
              <p style={S.qText}>
                {isVocab ? (
                  <span>
                    <span style={S.wordBig}>{item.word}</span>
                    <span style={S.wordPron}> {item.pronunciation}</span>
                  </span>
                ) : item.question}
              </p>
              <div style={S.optGrid}>
                {item.options.map((opt) => {
                  const sel = chosen === opt;
                  const isAns = isVocab ? opt === correct : opt[0] === correct[0];
                  return (
                    <button key={opt} onClick={() => !submitted && setAnswers({ ...answers, [item.id]: opt })}
                      style={{ ...S.opt, ...(sel ? S.optSel : {}), ...(submitted && isAns ? S.optOk : {}), ...(submitted && sel && !isAns ? S.optNg : {}) }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && item.explanation && <div style={S.explain}>💡 {item.explanation}</div>}
              {submitted && isVocab && <div style={S.example}>例文: {item.example}</div>}
            </div>
          );
        })}
        {!submitted ? (
          <button onClick={submit} disabled={Object.keys(answers).length < items.length}
            style={{ ...S.bigBtn, ...(Object.keys(answers).length < items.length ? S.bigBtnDisabled : {}) }}>
            採点する ({Object.keys(answers).length}/{items.length})
          </button>
        ) : (
          <div style={S.scoreCard}>
            <div style={S.scorePct}>{score?.pct}%</div>
            <div style={S.scoreDetail}>{score?.correct} / {score?.total} 問正解</div>
            <div style={S.scoreMsg}>
              {score?.pct === 100 ? "🎉 パーフェクト！" : score?.pct >= 75 ? "👍 よくできました！" : score?.pct >= 50 ? "📚 もう少し！" : "🔄 復習しましょう"}
            </div>
            <div style={S.roundBadge}>
              {MODES.find(m => m.id === activeMode)?.icon} {MODES.find(m => m.id === activeMode)?.label} 第{roundCounts[activeMode] || 1}回目
            </div>
            <div style={S.scoreBtns}>
              <button onClick={retry} style={S.outlineBtn}>もう一度</button>
              <button onClick={() => setShowRanking(true)} style={S.outlineBtn}>🏆 ランキング</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showRanking) {
    const top = [...rankings].sort((a, b) => b.score - a.score).slice(0, 20);
    return (
      <div style={S.root}>
        <style>{css}</style>
        <div style={S.rankHeader}>
          <button onClick={() => setShowRanking(false)} style={S.backBtn}>← 戻る</button>
          <h2 style={S.rankTitle}>🏆 ランキング</h2>
        </div>
        <div style={S.rankList}>
          {top.length === 0 ? <div style={S.empty}>まだ記録がありません</div> :
            top.map((r, i) => (
              <div key={i} style={{ ...S.rankRow, ...(i < 3 ? S.rankTop : {}) }}>
                <div style={S.rankPos}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}</div>
                <div style={S.rankInfo}>
                  <div style={S.rankName}>{r.name}</div>
                  <div style={S.rankMeta}>{r.mode} · {r.date} · 第{r.rounds}回</div>
                </div>
                <div style={S.rankScore}>{r.score}%</div>
              </div>
            ))}
        </div>
        <button onClick={() => { setRankings([]); localStorage.removeItem("rm_rankings"); }} style={S.clearBtn}>記録をリセット</button>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <style>{css}</style>
      {showNameModal && (
        <div style={S.modalOverlay}>
          <div style={S.modal}>
            <div style={S.modalTitle}>名前を入力してください</div>
            <p style={S.modalSub}>ランキングに表示されます</p>
            <input style={S.nameInput} value={nameInput} onChange={(e) => setNameInput(e.target.value)}
              placeholder="例: 田中" onKeyDown={(e) => e.key === "Enter" && confirmName()} autoFocus />
            <button onClick={confirmName} style={S.bigBtn}>登録してランキングに参加</button>
            <button onClick={() => { setShowNameModal(false); setPendingScore(null); }} style={S.skipBtn}>スキップ</button>
          </div>
        </div>
      )}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <span style={S.logoMark}>E</span>
            <span style={S.logoText}>ReadMaster</span>
          </div>
          <div style={S.headerRight}>
            {playerName && <span style={S.playerBadge}>👤 {playerName}</span>}
            <button onClick={() => setShowRanking(true)} style={S.rankBtn}>🏆</button>
            {phase === "study" && <button onClick={reset} style={S.resetBtn}>← 戻る</button>}
          </div>
        </div>
      </header>
      <main style={S.main}>
        {phase === "input" && (
          <div className="fade-in">
            <div style={S.titleBlock}>
              <h1 style={S.h1}>英語長文学習</h1>
              <p style={S.sub}>テキスト入力 or 写真撮影で問題を自動生成</p>
            </div>
            <div style={S.toggleRow}>
              <button onClick={() => setInputMode("text")} style={{ ...S.toggleBtn, ...(inputMode === "text" ? S.toggleActive : {}) }}>✏️ テキスト入力</button>
              <button onClick={() => setInputMode("image")} style={{ ...S.toggleBtn, ...(inputMode === "image" ? S.toggleActive : {}) }}>📷 写真・画像</button>
            </div>
            {inputMode === "text" ? (
              <div style={S.card}>
                <textarea style={S.textarea} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="ここに英文を貼り付けてください..." rows={10} />
                <div style={S.taFooter}>
                  <span style={S.charCount}>{text.length}文字</span>
                  <button onClick={() => setText(SAMPLE_TEXT)} style={S.sampleBtn}>サンプルを使う</button>
                </div>
              </div>
            ) : (
              <div style={S.card}>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                  onChange={handleImageSelect} style={{ display: "none" }} />
                {imagePreview ? (
                  <div>
                    <img src={imagePreview} alt="preview" style={S.imgPreview} />
                    <button onClick={() => { setImagePreview(null); setImageBase64(null); fileInputRef.current.value = ""; }} style={S.removeImg}>✕ 画像を削除</button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current.click()} style={S.uploadArea}>
                    <div style={S.uploadIcon}>📷</div>
                    <div style={S.uploadText}>カメラで撮影 or 画像を選択</div>
                    <div style={S.uploadHint}>教科書・プリントの写真をそのまま使えます</div>
                  </button>
                )}
              </div>
            )}
            {error && <div style={S.errBox}>{error}</div>}
            <button onClick={analyze} style={S.bigBtn} className="pulse-btn">AIで解析・問題生成 →</button>
          </div>
        )}
        {phase === "loading" && (
          <div style={S.loadWrap} className="fade-in">
            <div style={S.spinner} className="spin" />
            <p style={S.loadText}>{loadingMsg || "AIが問題を生成しています..."}</p>
          </div>
        )}
        {phase === "study" && (
          <div className="fade-in">
            <div style={S.statsBar}>
              {MODES.map((m) => (
                <div key={m.id} style={S.statItem}>
                  <div style={S.statIcon}>{m.icon}</div>
                  <div style={S.statNum}>{roundCounts[m.id] || 0}回</div>
                  <div style={S.statLabel}>{m.label}</div>
                </div>
              ))}
            </div>
            <div style={S.tabs}>
              {MODES.map((m) => (
                <button key={m.id} onClick={() => switchMode(m.id)}
                  style={{ ...S.tab, ...(activeMode === m.id ? S.tabActive : {}) }}
                  disabled={loadingMode === m.id}>
                  {loadingMode === m.id ? "生成中..." : `${m.icon} ${m.label}`}
                </button>
              ))}
            </div>
            {loadingMode === activeMode ? (
              <div style={S.loadWrap}><div style={S.spinner} className="spin" /><p style={S.loadText}>問題を生成中...</p></div>
            ) : renderQuiz()}
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0d0f14", color: "#e8e4d9", fontFamily: "'Georgia', serif", paddingBottom: 80 },
  header: { background: "#0d0f14", borderBottom: "1px solid #1e2130", position: "sticky", top: 0, zIndex: 100 },
  headerInner: { maxWidth: 680, margin: "0 auto", padding: "0 16px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  logoMark: { width: 30, height: 30, background: "#c8a96e", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: "bold", color: "#0d0f14", lineHeight: "30px", textAlign: "center" },
  logoText: { fontSize: 17, fontWeight: 600, color: "#e8e4d9" },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
  playerBadge: { fontSize: 13, color: "#c8a96e", background: "#1e1a12", padding: "4px 10px", borderRadius: 20 },
  rankBtn: { background: "none", border: "1px solid #2a2d3a", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 18 },
  resetBtn: { background: "none", border: "1px solid #2a2d3a", color: "#9a968e", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  main: { maxWidth: 680, margin: "0 auto", padding: "24px 16px" },
  titleBlock: { textAlign: "center", marginBottom: 24 },
  h1: { fontSize: 26, fontWeight: 400, margin: 0, color: "#e8e4d9" },
  sub: { color: "#6e6a61", fontSize: 14, marginTop: 6 },
  toggleRow: { display: "flex", gap: 8, marginBottom: 16 },
  toggleBtn: { flex: 1, padding: "12px", borderRadius: 8, border: "1px solid #2a2d3a", background: "#141720", color: "#9a968e", fontSize: 15, cursor: "pointer", fontFamily: "inherit" },
  toggleActive: { border: "1px solid #c8a96e", color: "#c8a96e", background: "#1e1a12" },
  card: { background: "#141720", border: "1px solid #1e2130", borderRadius: 12, padding: 16, marginBottom: 16 },
  textarea: { width: "100%", background: "#0d0f14", border: "1px solid #1e2130", borderRadius: 8, color: "#e8e4d9", padding: 14, fontSize: 15, lineHeight: 1.8, resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  taFooter: { display: "flex", justifyContent: "space-between", marginTop: 8 },
  charCount: { fontSize: 12, color: "#3a3d4a" },
  sampleBtn: { background: "none", border: "none", color: "#c8a96e", cursor: "pointer", fontSize: 13, textDecoration: "underline" },
  uploadArea: { width: "100%", background: "#0d0f14", border: "2px dashed #2a2d3a", borderRadius: 10, padding: "40px 20px", cursor: "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, boxSizing: "border-box" },
  uploadIcon: { fontSize: 40 },
  uploadText: { fontSize: 16, color: "#c8a96e" },
  uploadHint: { fontSize: 13, color: "#4a4d5a" },
  imgPreview: { width: "100%", borderRadius: 8, marginBottom: 10, maxHeight: 300, objectFit: "contain" },
  removeImg: { background: "none", border: "1px solid #3a3d4a", color: "#9a968e", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, width: "100%" },
  errBox: { background: "#200f0f", border: "1px solid #5a2a2a", borderRadius: 8, padding: "12px 16px", color: "#e07070", fontSize: 14, marginBottom: 16 },
  bigBtn: { width: "100%", background: "#c8a96e", border: "none", color: "#0d0f14", padding: "16px", borderRadius: 10, fontSize: 17, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 4 },
  bigBtnDisabled: { background: "#2a2d3a", color: "#4a4d5a", cursor: "not-allowed" },
  loadWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 260, gap: 16 },
  spinner: { width: 44, height: 44, border: "3px solid #1e2130", borderTop: "3px solid #c8a96e", borderRadius: "50%" },
  loadText: { color: "#6e6a61", fontSize: 15 },
  statsBar: { display: "flex", gap: 8, marginBottom: 20 },
  statItem: { flex: 1, background: "#141720", border: "1px solid #1e2130", borderRadius: 10, padding: "10px 8px", textAlign: "center" },
  statIcon: { fontSize: 18 },
  statNum: { fontSize: 20, fontWeight: 600, color: "#c8a96e", lineHeight: 1.2 },
  statLabel: { fontSize: 11, color: "#6e6a61" },
  tabs: { display: "flex", gap: 4, marginBottom: 20 },
  tab: { flex: 1, background: "none", border: "1px solid #1e2130", borderRadius: 8, color: "#6e6a61", padding: "10px 6px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  tabActive: { border: "1px solid #c8a96e", color: "#c8a96e", background: "#1e1a12" },
  qCard: { background: "#141720", border: "1px solid #1e2130", borderRadius: 12, padding: 18, marginBottom: 14, transition: "border-color 0.3s" },
  qGood: { borderColor: "#2a5a3a" },
  qBad: { borderColor: "#5a2a2a" },
  qNum: { fontSize: 11, letterSpacing: "0.1em", color: "#c8a96e", textTransform: "uppercase", marginBottom: 8 },
  qText: { fontSize: 15, lineHeight: 1.7, margin: "0 0 14px", color: "#e8e4d9" },
  wordBig: { fontSize: 24, fontWeight: 600, color: "#e8e4d9" },
  wordPron: { fontSize: 14, color: "#6e6a61", fontFamily: "monospace" },
  optGrid: { display: "flex", flexDirection: "column", gap: 8 },
  opt: { background: "#0d0f14", border: "1px solid #1e2130", color: "#9a968e", padding: "12px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 14, lineHeight: 1.5, transition: "all 0.15s", fontFamily: "inherit" },
  optSel: { borderColor: "#c8a96e", color: "#c8a96e", background: "#1e1a12" },
  optOk: { borderColor: "#3a8a5a", color: "#3a8a5a", background: "#0f1f16" },
  optNg: { borderColor: "#8a3a3a", color: "#8a3a3a", background: "#1a0f0f" },
  explain: { marginTop: 10, fontSize: 13, color: "#9a968e", lineHeight: 1.6, background: "#0d0f14", padding: "8px 12px", borderRadius: 6 },
  example: { marginTop: 6, fontSize: 13, color: "#5a6a5a", fontStyle: "italic" },
  scoreCard: { background: "#141720", border: "1px solid #1e2130", borderRadius: 14, padding: 28, textAlign: "center", marginTop: 8 },
  scorePct: { fontSize: 56, fontWeight: 300, color: "#c8a96e" },
  scoreDetail: { fontSize: 16, color: "#9a968e", marginBottom: 8 },
  scoreMsg: { fontSize: 18, marginBottom: 12 },
  roundBadge: { display: "inline-block", background: "#1e1a12", border: "1px solid #c8a96e", color: "#c8a96e", borderRadius: 20, padding: "4px 14px", fontSize: 13, marginBottom: 20 },
  scoreBtns: { display: "flex", gap: 10 },
  outlineBtn: { flex: 1, background: "none", border: "1px solid #2a2d3a", color: "#9a968e", padding: "12px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontFamily: "inherit" },
  rankHeader: { maxWidth: 680, margin: "0 auto", padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 16 },
  backBtn: { background: "none", border: "1px solid #2a2d3a", color: "#9a968e", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  rankTitle: { fontSize: 22, fontWeight: 400, margin: 0, color: "#e8e4d9" },
  rankList: { maxWidth: 680, margin: "16px auto 0", padding: "0 16px" },
  rankRow: { display: "flex", alignItems: "center", gap: 14, background: "#141720", border: "1px solid #1e2130", borderRadius: 10, padding: "14px 16px", marginBottom: 8 },
  rankTop: { border: "1px solid rgba(200,169,110,0.3)", background: "#1a1712" },
  rankPos: { fontSize: 22, minWidth: 36, textAlign: "center" },
  rankInfo: { flex: 1 },
  rankName: { fontSize: 16, color: "#e8e4d9", fontWeight: 600 },
  rankMeta: { fontSize: 12, color: "#6e6a61", marginTop: 2 },
  rankScore: { fontSize: 24, fontWeight: 300, color: "#c8a96e" },
  empty: { textAlign: "center", color: "#4a4d5a", padding: "40px 0" },
  clearBtn: { display: "block", margin: "20px auto", background: "none", border: "1px solid #3a1a1a", color: "#6a3a3a", padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 },
  modal: { background: "#141720", border: "1px solid #2a2d3a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, textAlign: "center" },
  modalTitle: { fontSize: 20, fontWeight: 600, color: "#e8e4d9", marginBottom: 8 },
  modalSub: { color: "#6e6a61", fontSize: 14, marginBottom: 20 },
  nameInput: { width: "100%", background: "#0d0f14", border: "1px solid #2a2d3a", borderRadius: 8, color: "#e8e4d9", padding: "14px", fontSize: 17, fontFamily: "inherit", outline: "none", marginBottom: 12, boxSizing: "border-box", textAlign: "center" },
  skipBtn: { background: "none", border: "none", color: "#4a4d5a", fontSize: 13, cursor: "pointer", marginTop: 10 },
};

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .fade-in { animation: fadeIn 0.35s ease; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .spin { animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pulse-btn:active { transform: scale(0.98); }
  textarea:focus { border-color: #c8a96e !important; }
  input:focus { border-color: #c8a96e !important; }
`;
