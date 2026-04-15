import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import CardFrame from "../components/CardFrame";
import { loadJSON, saveJSON } from "../lib/storage";
import { oddApi, isDesktop } from "../lib/odd";

type Chapter = {
  title: string;
  notes?: string;
  draft?: string; // v10.22.3+: full text for the chapter
};

type Book = {
  id: string;
  title: string;
  subtitle?: string;
  status: "Idea" | "Drafting" | "Revising" | "Editing" | "Publishing";
  logline?: string;
  notes?: string;
  chapters: Chapter[];
  updatedAt: number;
};

type WriterMsg = { role: "user" | "assistant"; content: string; ts: number };

const KEY = "oddengine:books:v1";
const KEY_ACTIVE = "oddengine:books:active";
const KEY_ACTIVE_CH = "oddengine:books:activeChapter";
const KEY_CHAT = "oddengine:writers:chat:v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function wordCount(text: string) {
  const t = (text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function estimateMinutes(words: number) {
  // simple: 200 wpm reading
  return Math.max(1, Math.round(words / 200));
}

export default function Books({ onNavigate }: { onNavigate: (panelId: string) => void }) {
  const [books, setBooks] = useState<Book[]>(() => loadJSON<Book[]>(KEY, []));
  const [activeId, setActiveId] = useState<string>(() => loadJSON<string>(KEY_ACTIVE, ""));
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(() => {
    const n = Number(loadJSON<any>(KEY_ACTIVE_CH, 0));
    return Number.isFinite(n) ? n : 0;
  });

  const active = useMemo(() => books.find((b) => b.id === activeId) || books[0], [books, activeId]);
  const chapters = active?.chapters || [];
  const safeChapterIdx = Math.max(0, Math.min(chapters.length - 1, activeChapterIdx));
  const chapter = chapters[safeChapterIdx];

  useEffect(() => {
    saveJSON(KEY_ACTIVE_CH, safeChapterIdx);
  }, [safeChapterIdx]);

  const persist = (next: Book[]) => {
    setBooks(next);
    saveJSON(KEY, next);
  };

  const upsert = (b: Book) => {
    const next = books.some((x) => x.id === b.id) ? books.map((x) => (x.id === b.id ? b : x)) : [b, ...books];
    persist(next);
  };

  const remove = (id: string) => {
    const next = books.filter((b) => b.id !== id);
    persist(next);
    if (activeId === id) {
      const nid = next[0]?.id || "";
      setActiveId(nid);
      saveJSON(KEY_ACTIVE, nid);
      setActiveChapterIdx(0);
    }
  };

  const ensureChapter = () => {
    if (!active) return;
    if (!active.chapters.length) {
      const next = { ...active, chapters: [{ title: "Chapter 1", notes: "", draft: "" }], updatedAt: Date.now() };
      upsert(next);
      setActiveChapterIdx(0);
    }
  };

  // Writers assistant (embedded)
  const [chat, setChat] = useState<WriterMsg[]>(() => loadJSON<WriterMsg[]>(KEY_CHAT, []));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const systemPrompt = useMemo(() => {
    const title = active?.title || "Untitled";
    const status = active?.status || "Idea";
    const logline = active?.logline || "";
    const chTitle = chapter?.title || "";
    return (
      "You are Homie — a high-energy, Fortnite-mascot vibe writing buddy. " +
      "Help the user write and ship a book. Be creative, but organized. " +
      "Prefer concrete options (3 variants) and next-step checklists. " +
      "Avoid long lectures. Ask 1 question only if truly necessary.\n\n" +
      `Current book: ${title}\nStatus: ${status}\nLogline: ${logline}\nCurrent chapter: ${chTitle}`
    );
  }, [active?.title, active?.status, active?.logline, chapter?.title]);

  useEffect(() => {
    saveJSON(KEY_CHAT, chat);
    // auto-scroll
    try {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch {
      // ignore
    }
  }, [chat]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    const nextChat: WriterMsg[] = [...chat, { role: "user", content: t, ts: Date.now() }];
    setChat(nextChat);
    setInput("");
    setBusy(true);

    try {
      const api = oddApi();
      // Desktop: local Ollama through preload. Web: show a helpful fallback.
      if (!isDesktop() || !api.homieChat) {
        const msg = "(Writer assistant is local-only right now. Open the Homie panel or run Desktop mode for in-panel replies.)";
        setChat((c) => [...c, { role: "assistant", content: msg, ts: Date.now() }]);
        return;
      }

      const payloadMsgs = nextChat.slice(-10).map((m) => ({ role: m.role, content: m.content })) as any;
      const res = await api.homieChat({ messages: [{ role: "system", content: systemPrompt }, ...payloadMsgs] });
      if (!res?.ok) {
        setChat((c) => [...c, { role: "assistant", content: res?.error ? `Error: ${res.error}` : "Writer assistant failed.", ts: Date.now() }]);
        return;
      }
      setChat((c) => [...c, { role: "assistant", content: String(res.reply || ""), ts: Date.now() }]);
    } catch (e: any) {
      setChat((c) => [...c, { role: "assistant", content: e?.message || String(e), ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  };

  const insertLastAssistantIntoDraft = () => {
    if (!active || !chapter) return;
    const last = [...chat].reverse().find((m) => m.role === "assistant");
    if (!last?.content) return;
    const chapters2 = chapters.map((c, i) => (i === safeChapterIdx ? { ...c, draft: (c.draft || "") + (c.draft ? "\n\n" : "") + last.content } : c));
    upsert({ ...active, chapters: chapters2, updatedAt: Date.now() });
  };

  const copyActiveChapter = async () => {
    if (!chapter) return;
    const md = `# ${active?.title || "Untitled"}\n\n## ${chapter.title}\n\n${chapter.draft || ""}\n`;
    try {
      await navigator.clipboard?.writeText(md);
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "ok", text: "Copied chapter markdown." } }));
    } catch {
      // ignore
    }
  };

  // UI state
  const [tab, setTab] = useState<"desk" | "chapters" | "export">("desk");

  const draftText = chapter?.draft || "";
  const wc = wordCount(draftText);
  const minutes = estimateMinutes(wc);

  return (
    <div className="panelRoot">
      <PanelHeader
        title="✍️ Writers Lounge"
        subtitle="Your Books Vault + an embedded AI writing assistant. Local-first, ship-focused."
        panelId="Books"
        storagePrefix="oddengine:books"
        showCopilot
      />

      <div className="writersGrid">
        {/* Left: Library */}
        <div className="writersLeft">
          <CardFrame title="Library" subtitle="Your writing stack" storageKey="writers:library" className="softCard" defaultFloating={false}>
            <div className="cluster wrap spread">
              <button
                className="tabBtn"
                onClick={() => {
                  const b: Book = { id: uid(), title: "Untitled Book", status: "Idea", chapters: [], updatedAt: Date.now() };
                  upsert(b);
                  setActiveId(b.id);
                  saveJSON(KEY_ACTIVE, b.id);
                  setActiveChapterIdx(0);
                }}
              >
                Add book
              </button>
              <div className="small">{books.length} total</div>
            </div>

            <div className="grid">
              {books.length === 0 ? (
                <div className="small">No books yet. Hit <b>Add book</b> and we’ll start building your vault.</div>
              ) : (
                books.map((b) => (
                  <div key={b.id} className="cluster spread">
                    <button
                      className={`tabBtn ${active?.id === b.id ? "active" : ""}`}
                      style={{ flex: 1, textAlign: "left" }}
                      onClick={() => {
                        setActiveId(b.id);
                        saveJSON(KEY_ACTIVE, b.id);
                        setActiveChapterIdx(0);
                      }}
                    >
                      <b>{b.title}</b>
                      <span className="small" style={{ marginLeft: 10 }}>
                        {b.status} • {b.chapters.length} chapters
                      </span>
                    </button>
                    <button className="tabBtn" onClick={() => remove(b.id)} title="Remove">
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </CardFrame>

          <CardFrame title="Tools" subtitle="Creative workflow shortcuts" storageKey="writers:tools" className="softCard" defaultCollapsed={false}>
            <div className="row wrap">
              <button className="tabBtn" onClick={() => onNavigate("Builder")}>🧱 Layout / Covers</button>
              <button className="tabBtn" onClick={() => onNavigate("Money")}>💵 Monetize / KDP</button>
              <button className="tabBtn" onClick={() => onNavigate("DevEngine")}>🧩 Assets / Builds</button>
              <button className="tabBtn" onClick={() => onNavigate("Brain")}>🧠 Notes / Memory</button>
              <button className="tabBtn" onClick={() => onNavigate("Calendar")}>📅 Deadlines</button>
            </div>
            <div className="note">
              Pro move: schedule “Write 30 min” blocks in Calendar and link them to this panel.
            </div>
          </CardFrame>
        </div>

        {/* Center: Writing Desk */}
        <div className="writersCenter">
          <div className="card softCard">
            <div className="cluster wrap spread">
              <div>
                <div className="h">Writing Desk</div>
                <div className="sub">Write, revise, and ship. Keep it simple, keep it moving.</div>
              </div>
              <div className="tabs">
                <button className={"tabBtn " + (tab === "desk" ? "active" : "")} onClick={() => setTab("desk")}>Desk</button>
                <button className={"tabBtn " + (tab === "chapters" ? "active" : "")} onClick={() => { ensureChapter(); setTab("chapters"); }}>Chapters</button>
                <button className={"tabBtn " + (tab === "export" ? "active" : "")} onClick={() => setTab("export")}>Export</button>
              </div>
            </div>

            {!active ? (
              <div className="note mt-5">Pick a book from the Library to start writing.</div>
            ) : (
              <div className="grid mt-5">
                <div className="cluster wrap">
                  <input
                    className="input"
                    style={{ flex: 1, minWidth: 240 }}
                    value={active.title}
                    onChange={(e) => upsert({ ...active, title: e.target.value, updatedAt: Date.now() })}
                    placeholder="Book title"
                  />
                  <select
                    className="input"
                    value={active.status}
                    onChange={(e) => upsert({ ...active, status: e.target.value as any, updatedAt: Date.now() })}
                    style={{ maxWidth: 220 }}
                  >
                    {(["Idea", "Drafting", "Revising", "Editing", "Publishing"] as const).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {tab === "desk" && (
                  <>
                    <input
                      className="input"
                      value={active.subtitle || ""}
                      onChange={(e) => upsert({ ...active, subtitle: e.target.value, updatedAt: Date.now() })}
                      placeholder="Subtitle (optional)"
                    />
                    <textarea
                      className="input"
                      style={{ minHeight: 80 }}
                      value={active.logline || ""}
                      onChange={(e) => upsert({ ...active, logline: e.target.value, updatedAt: Date.now() })}
                      placeholder="Logline / hook (1–3 sentences)"
                    />

                    <div className="cluster wrap spread">
                      <div className="small" style={{ opacity: 0.9 }}>
                        Chapter: <b>{chapter?.title || "(none)"}</b> • <b>{wc}</b> words • ~{minutes} min read
                      </div>
                      <div className="row wrap">
                        <button className="tabBtn" onClick={ensureChapter}>+ Ensure chapter</button>
                        <button className="tabBtn" onClick={copyActiveChapter} disabled={!chapter}>Copy chapter</button>
                      </div>
                    </div>

                    {!chapter ? (
                      <div className="note">No chapters yet. Hit <b>+ Ensure chapter</b> (or add chapters in the Chapters tab).</div>
                    ) : (
                      <>
                        <textarea
                          className="input"
                          style={{ minHeight: 320 }}
                          value={chapter.draft || ""}
                          onChange={(e) => {
                            const chapters2 = chapters.map((c, i) => (i === safeChapterIdx ? { ...c, draft: e.target.value } : c));
                            upsert({ ...active, chapters: chapters2, updatedAt: Date.now() });
                          }}
                          placeholder="Write the chapter draft here…"
                        />
                        <textarea
                          className="input"
                          style={{ minHeight: 120 }}
                          value={chapter.notes || ""}
                          onChange={(e) => {
                            const chapters2 = chapters.map((c, i) => (i === safeChapterIdx ? { ...c, notes: e.target.value } : c));
                            upsert({ ...active, chapters: chapters2, updatedAt: Date.now() });
                          }}
                          placeholder="Scene beats / notes / research for this chapter…"
                        />
                      </>
                    )}
                  </>
                )}

                {tab === "chapters" && (
                  <>
                    <div className="cluster wrap spread">
                      <button
                        className="tabBtn"
                        onClick={() => {
                          const next = [...active.chapters, { title: `Chapter ${active.chapters.length + 1}`, notes: "", draft: "" }];
                          upsert({ ...active, chapters: next, updatedAt: Date.now() });
                          setActiveChapterIdx(next.length - 1);
                        }}
                      >
                        Add chapter
                      </button>
                      <div className="small">Tip: Keep chapter titles punchy. Add scene beats in notes.</div>
                    </div>

                    <div className="grid mt-4">
                      {active.chapters.map((c, idx) => (
                        <div key={idx} className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                          <div className="cluster spread">
                            <button
                              className={"tabBtn " + (idx === safeChapterIdx ? "active" : "")}
                              style={{ flex: 1, textAlign: "left" }}
                              onClick={() => setActiveChapterIdx(idx)}
                            >
                              <b>{c.title}</b>
                              <span className="small" style={{ marginLeft: 10 }}>{wordCount(c.draft || "")} words</span>
                            </button>
                            <button
                              className="tabBtn"
                              onClick={() => {
                                const next = active.chapters.filter((_, i) => i !== idx);
                                upsert({ ...active, chapters: next, updatedAt: Date.now() });
                                setActiveChapterIdx(Math.max(0, idx - 1));
                              }}
                              title="Remove chapter"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="mt-3">
                            <input
                              className="input"
                              value={c.title}
                              onChange={(e) => {
                                const next = active.chapters.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x));
                                upsert({ ...active, chapters: next, updatedAt: Date.now() });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tab === "export" && (
                  <>
                    <div className="note">
                      Export helpers. Everything is local-first. Copy markdown, or use Dev Engine later to export files.
                    </div>
                    <div className="row wrap">
                      <button className="tabBtn" onClick={copyActiveChapter} disabled={!chapter}>Copy chapter markdown</button>
                      <button
                        className="tabBtn"
                        onClick={() => {
                          if (!active) return;
                          const payload = JSON.stringify(active, null, 2);
                          navigator.clipboard?.writeText(payload);
                          window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "ok", text: "Copied book JSON." } }));
                        }}
                      >
                        Copy book JSON
                      </button>
                      <button className="tabBtn" onClick={() => onNavigate("Money")}>Open KDP checklist</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: AI Writing Assistant */}
        <div className="writersRight">
          <div className="card softCard">
            <div className="cluster wrap spread">
              <div>
                <div className="h">AI Writing Assistant</div>
                <div className="sub">Embedded “Homie” for outlining, rewrites, and scene generation.</div>
              </div>
              <div className="row wrap">
                <button className="tabBtn" onClick={() => setChat([])}>Clear</button>
                <button className="tabBtn" onClick={insertLastAssistantIntoDraft} disabled={!chapter}>Insert → draft</button>
              </div>
            </div>

            <div className="writersPromptRow mt-4">
              <button className="tabBtn" onClick={() => send("Give me 3 chapter outline options for the current chapter.")}>Outline</button>
              <button className="tabBtn" onClick={() => send("Rewrite the last paragraph with more punch and emotion. Give 3 versions.")}>Rewrite</button>
              <button className="tabBtn" onClick={() => send("Write the next scene. Keep it vivid and fast-paced. End on a hook.")}>Next scene</button>
              <button className="tabBtn" onClick={() => send("Give me 5 title/subtitle ideas for this book.")}>Titles</button>
            </div>

            <div className="writersChat mt-4">
              {chat.length ? (
                chat.map((m, i) => (
                  <div key={i} className={"writersBubble " + (m.role === "user" ? "user" : "assistant")}
                    title={new Date(m.ts).toLocaleString()}
                  >
                    {m.content}
                  </div>
                ))
              ) : (
                <div className="small" style={{ opacity: 0.85 }}>
                  Ask for an outline, scene, rewrite, or a publish checklist. (Desktop mode will answer in-panel.)
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="cluster mt-4">
              <input
                className="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={busy ? "Thinking…" : "Ask Homie (outline, rewrite, scene, tone…)"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <button className="tabBtn" disabled={busy} onClick={() => send(input)}>
                Send
              </button>
            </div>

            {!isDesktop() && (
              <div className="note">
                Running Web mode. For in-panel AI replies, use Desktop mode (local Ollama) or open the Homie panel.
                <div className="cluster wrap mt-3">
                  <button className="tabBtn" onClick={() => onNavigate("Homie")}>Open Homie</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
