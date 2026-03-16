import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_WRITER_PROJECTS,
  PROJECT_STAGE_LABELS,
  WriterProject,
  WriterStage,
  buildProjectStats,
  formatFileSize,
  getStageTone,
  makeProjectFromFile,
  normalizeTags,
  safeLoadWriterVault,
  safeSaveWriterVault,
  sortProjects,
} from "../lib/writerVault";

type Tab = "vault" | "resume" | "queue" | "notes";
type SortMode = "recent" | "title" | "priority";

function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`tabBtn ${active ? "active" : ""}`}
      style={{ borderRadius: 999, padding: "8px 12px" }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.035)",
  borderRadius: 16,
  padding: 14,
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
  borderRadius: 12,
  padding: "10px 12px",
};

function stageToneStyle(stage: WriterStage) {
  if (stage === "finished") return { background: "rgba(94,201,111,0.16)", borderColor: "rgba(94,201,111,0.28)" };
  if (stage === "revise") return { background: "rgba(255,154,87,0.16)", borderColor: "rgba(255,154,87,0.28)" };
  if (stage === "draft") return { background: "rgba(255,214,92,0.16)", borderColor: "rgba(255,214,92,0.28)" };
  return { background: "rgba(103,182,255,0.16)", borderColor: "rgba(103,182,255,0.28)" };
}

export default function Books() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<Tab>("vault");
  const [stageFilter, setStageFilter] = useState<WriterStage | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [projects, setProjects] = useState<WriterProject[]>(DEFAULT_WRITER_PROJECTS);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    setProjects(safeLoadWriterVault());
  }, []);

  useEffect(() => {
    safeSaveWriterVault(projects);
  }, [projects]);

  useEffect(() => {
    if (!selectedId && projects.length) {
      setSelectedId(projects[0].id);
    }
    if (selectedId && !projects.some((project) => project.id === selectedId)) {
      setSelectedId(projects[0]?.id ?? "");
    }
  }, [projects, selectedId]);

  const visibleProjects = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    const filtered = projects.filter((project) => {
      if (!showArchived && project.archived) return false;
      if (stageFilter !== "all" && project.stage !== stageFilter) return false;
      if (!lowered) return true;
      const haystack = [
        project.title,
        project.fileName,
        project.summary,
        project.resumeFrom,
        project.lane,
        ...(project.tags ?? []),
      ].join(" ").toLowerCase();
      return haystack.includes(lowered);
    });
    return sortProjects(filtered, sortMode);
  }, [projects, stageFilter, sortMode, query, showArchived]);

  const selectedProject = useMemo(
    () => visibleProjects.find((project) => project.id === selectedId) ?? projects.find((project) => project.id === selectedId) ?? null,
    [visibleProjects, projects, selectedId]
  );

  const stats = useMemo(() => buildProjectStats(projects), [projects]);

  const handleUploadClick = () => inputRef.current?.click();

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const nextProjects = Array.from(files).map((file, index) => makeProjectFromFile(file, index));
    setProjects((current) => [...nextProjects, ...current]);
    setSelectedId(nextProjects[0]?.id ?? "");
  };

  const updateProject = (id: string, patch: Partial<WriterProject>) => {
    setProjects((current) =>
      current.map((project) =>
        project.id === id
          ? {
              ...project,
              ...patch,
              updatedAt: new Date().toLocaleDateString(),
              notesCount: patch.notes ? patch.notes.length : project.notesCount,
            }
          : project
      )
    );
  };

  const addTweak = () => {
    if (!selectedProject) return;
    updateProject(selectedProject.id, {
      tweakQueue: [...selectedProject.tweakQueue, "New tweak item"],
    });
  };

  const addNote = () => {
    if (!selectedProject) return;
    const nextNotes = [...selectedProject.notes, "New note"];
    updateProject(selectedProject.id, {
      notes: nextNotes,
      notesCount: nextNotes.length,
    });
  };

  return (
    <div className="stack">
      <div className="card softCard" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="small shellEyebrow">Creative engine / manuscript vault</div>
            <div className="h">Writing Lounge</div>
            <div className="sub">
              Stronger manuscript shelf, real resume points, favorite projects, search, and local persistence so your books keep moving.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ ...card, minWidth: 120 }}>
              <div className="small">Projects</div>
              <b>{stats.totalProjects}</b>
            </div>
            <div style={{ ...card, minWidth: 120 }}>
              <div className="small">Needs revision</div>
              <b>{stats.revisionCount}</b>
            </div>
            <div style={{ ...card, minWidth: 120 }}>
              <div className="small">Favorites</div>
              <b>{stats.favorites}</b>
            </div>
            <div style={{ ...card, minWidth: 120 }}>
              <div className="small">Queued tweaks</div>
              <b>{stats.totalQueuedTweaks}</b>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill active={tab === "vault"} onClick={() => setTab("vault")}>Vault</Pill>
          <Pill active={tab === "resume"} onClick={() => setTab("resume")}>Resume</Pill>
          <Pill active={tab === "queue"} onClick={() => setTab("queue")}>Tweak queue</Pill>
          <Pill active={tab === "notes"} onClick={() => setTab("notes")}>Notes</Pill>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="input"
            placeholder="Search titles, tags, lanes, or notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <select className="input" value={stageFilter} onChange={(e) => setStageFilter(e.target.value as WriterStage | "all")} style={{ minWidth: 150 }}>
            <option value="all">All stages</option>
            {Object.entries(PROJECT_STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select className="input" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} style={{ minWidth: 150 }}>
            <option value="priority">Priority</option>
            <option value="recent">Recent</option>
            <option value="title">Title</option>
          </select>
          <label className="muted" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
          <button className="tabBtn active" type="button" onClick={handleUploadClick}>Upload manuscript</button>
          <input
            ref={inputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
            accept=".doc,.docx,.pdf,.txt,.md,.rtf"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,0.92fr) minmax(0,1.2fr)", gap: 12 }}>
        <div className="card softCard">
          <div className="small shellEyebrow">Bookshelf</div>
          <div className="h">Vault shelf</div>
          <div className="stack" style={{ marginTop: 10 }}>
            {visibleProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedId(project.id)}
                style={{
                  ...row,
                  cursor: "pointer",
                  textAlign: "left",
                  borderColor: selectedId === project.id ? "rgba(110,231,255,0.35)" : "rgba(255,255,255,0.06)",
                  background: selectedId === project.id ? "rgba(110,231,255,0.08)" : "rgba(255,255,255,0.025)",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{project.title}</strong>
                    {project.favorite ? <span className="small">★</span> : null}
                    {project.archived ? <span className="small muted">archived</span> : null}
                  </div>
                  <div className="muted">{project.fileName} · {project.format} · {formatFileSize(project.fileSize)}</div>
                </div>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "5px 8px",
                    fontSize: 11,
                    border: "1px solid rgba(255,255,255,0.08)",
                    ...stageToneStyle(project.stage),
                  }}
                >
                  {PROJECT_STAGE_LABELS[project.stage]}
                </span>
              </button>
            ))}

            {!visibleProjects.length ? (
              <div style={row}>
                <span className="muted">No projects match that filter yet.</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="stack">
          {selectedProject ? (
            <>
              <div className="card softCard">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div>
                    <div className="small shellEyebrow">Active project</div>
                    <div className="h">{selectedProject.title}</div>
                    <div className="sub">{selectedProject.fileName} · {selectedProject.format} · Updated {selectedProject.updatedAt}</div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="tabBtn"
                      type="button"
                      onClick={() => updateProject(selectedProject.id, { favorite: !selectedProject.favorite })}
                    >
                      {selectedProject.favorite ? "Unfavorite" : "Favorite"}
                    </button>
                    <button
                      className="tabBtn"
                      type="button"
                      onClick={() => updateProject(selectedProject.id, { archived: !selectedProject.archived })}
                    >
                      {selectedProject.archived ? "Unarchive" : "Archive"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10, marginTop: 10 }}>
                  <div style={card}><div className="small">Stage</div><b>{PROJECT_STAGE_LABELS[selectedProject.stage]}</b></div>
                  <div style={card}><div className="small">Chapters</div><b>{selectedProject.chapters}</b></div>
                  <div style={card}><div className="small">Notes</div><b>{selectedProject.notesCount}</b></div>
                  <div style={card}><div className="small">Lane</div><b>{selectedProject.lane}</b></div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <div className="stack">
                    <label className="small">Summary</label>
                    <textarea
                      className="input"
                      rows={4}
                      value={selectedProject.summary}
                      onChange={(e) => updateProject(selectedProject.id, { summary: e.target.value })}
                    />
                  </div>

                  <div className="stack">
                    <label className="small">Resume from</label>
                    <textarea
                      className="input"
                      rows={4}
                      value={selectedProject.resumeFrom}
                      onChange={(e) => updateProject(selectedProject.id, { resumeFrom: e.target.value })}
                    />
                  </div>

                  <div className="stack">
                    <label className="small">Stage</label>
                    <select
                      className="input"
                      value={selectedProject.stage}
                      onChange={(e) => updateProject(selectedProject.id, { stage: e.target.value as WriterStage })}
                    >
                      {Object.entries(PROJECT_STAGE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="stack">
                    <label className="small">Tags (comma-separated)</label>
                    <input
                      className="input"
                      value={(selectedProject.tags ?? []).join(", ")}
                      onChange={(e) => updateProject(selectedProject.id, { tags: normalizeTags(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {tab === "vault" ? (
                <div className="card softCard">
                  <div className="small shellEyebrow">Project overview</div>
                  <div className="h">Shelf view</div>
                  <p className="muted" style={{ marginTop: 8 }}>{selectedProject.summary}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {(selectedProject.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        style={{
                          borderRadius: 999,
                          padding: "4px 8px",
                          fontSize: 11,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === "resume" ? (
                <div className="card softCard">
                  <div className="small shellEyebrow">Resume lane</div>
                  <div className="h">Where to pick back up</div>
                  <p className="muted" style={{ marginTop: 8 }}>{selectedProject.resumeFrom}</p>
                  <div style={{ ...card, marginTop: 10 }}>
                    <div className="small">Why this matters</div>
                    <div className="muted">Leave yourself a real restart sentence so the next session begins with momentum instead of confusion.</div>
                  </div>
                </div>
              ) : null}

              {tab === "queue" ? (
                <div className="card softCard">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div className="small shellEyebrow">Tweak queue</div>
                      <div className="h">Finish and polish list</div>
                    </div>
                    <button className="tabBtn" type="button" onClick={addTweak}>Add tweak</button>
                  </div>

                  <div className="stack" style={{ marginTop: 10 }}>
                    {selectedProject.tweakQueue.map((item, index) => (
                      <div style={row} key={`${item}-${index}`}>
                        <input
                          className="input"
                          value={item}
                          onChange={(e) => {
                            const next = [...selectedProject.tweakQueue];
                            next[index] = e.target.value;
                            updateProject(selectedProject.id, { tweakQueue: next });
                          }}
                        />
                        <button
                          className="tabBtn"
                          type="button"
                          onClick={() => {
                            const next = selectedProject.tweakQueue.filter((_, idx) => idx !== index);
                            updateProject(selectedProject.id, { tweakQueue: next });
                          }}
                        >
                          Done
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {tab === "notes" ? (
                <div className="card softCard">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div className="small shellEyebrow">Notes shelf</div>
                      <div className="h">Context and prompts</div>
                    </div>
                    <button className="tabBtn" type="button" onClick={addNote}>Add note</button>
                  </div>

                  <div className="stack" style={{ marginTop: 10 }}>
                    {selectedProject.notes.map((note, index) => (
                      <div style={row} key={`${note}-${index}`}>
                        <textarea
                          className="input"
                          rows={3}
                          value={note}
                          onChange={(e) => {
                            const next = [...selectedProject.notes];
                            next[index] = e.target.value;
                            updateProject(selectedProject.id, { notes: next, notesCount: next.length });
                          }}
                        />
                        <button
                          className="tabBtn"
                          type="button"
                          onClick={() => {
                            const next = selectedProject.notes.filter((_, idx) => idx !== index);
                            updateProject(selectedProject.id, { notes: next, notesCount: next.length });
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="card softCard">
              <div className="h">Select a manuscript</div>
              <div className="sub" style={{ marginTop: 6 }}>Pick a project from the vault shelf to resume, tweak, or organize it.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
