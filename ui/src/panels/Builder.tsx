
import React, { useMemo, useState } from "react";
import { downloadTextFile, downloadZip } from "../lib/files";
import { loadJSON, saveJSON } from "../lib/storage";
import {
  LEGACY_PHASES,
  LEGACY_SEED_NOTES,
  LEGACY_SEED_STATUSES,
  LEGACY_STATUS_OPTIONS,
  LEGACY_STORAGE_KEYS,
  buildLegacyCsv,
  buildLegacyExportFiles,
  buildLegacyMarkdown,
  buildLegacyStatusBoard,
  getLegacyRows,
  type LegacyStatus,
} from "../lib/legacyChecklist";

const toneByStatus: Record<LegacyStatus, { pill: string; border: string }> = {
  "Not Started": { pill: "rgba(125,135,155,0.18)", border: "rgba(125,135,155,0.35)" },
  "In Progress": { pill: "rgba(96,165,250,0.16)", border: "rgba(96,165,250,0.4)" },
  "Locked": { pill: "rgba(250,204,21,0.16)", border: "rgba(250,204,21,0.4)" },
  "Needs Repair": { pill: "rgba(248,113,113,0.16)", border: "rgba(248,113,113,0.42)" },
  "Complete": { pill: "rgba(74,222,128,0.16)", border: "rgba(74,222,128,0.42)" },
};

type FilterStatus = LegacyStatus | "All";
type SortMode = "priority" | "phase" | "title" | "status";

function Badge({
  label,
  status,
}: {
  label: string;
  status: LegacyStatus;
}) {
  const tone = toneByStatus[status];
  return (
    <span
      className="badge"
      style={{
        background: tone.pill,
        border: `1px solid ${tone.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function SectionCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card" style={{ background: "rgba(8,12,18,0.38)" }}>
      <div className="small" style={{ opacity: 0.78 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 900, marginTop: 6 }}>{value}</div>
      <div className="small" style={{ marginTop: 6 }}>{sub}</div>
    </div>
  );
}

export default function Builder() {
  const [statuses, setStatuses] = useState<Record<string, LegacyStatus>>(() =>
    loadJSON<Record<string, LegacyStatus>>(LEGACY_STORAGE_KEYS.statuses, LEGACY_SEED_STATUSES)
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    loadJSON<Record<string, string>>(LEGACY_STORAGE_KEYS.notes, LEGACY_SEED_NOTES)
  );
  const [phaseFilter, setPhaseFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("All");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("core-shell");

  const rows = useMemo(() => getLegacyRows(statuses, notes), [statuses, notes]);

  const summary = useMemo(() => {
    const total = rows.length;
    const complete = rows.filter((row) => row.status === "Complete").length;
    const critical = rows.filter((row) => row.critical).length;
    const criticalUnsafe = rows.filter((row) => row.critical && row.status !== "Locked" && row.status !== "Complete").length;
    const repair = rows.filter((row) => row.status === "Needs Repair").length;
    const progress = total ? Math.round((complete / total) * 100) : 0;
    return { total, complete, critical, criticalUnsafe, repair, progress };
  }, [rows]);

  const phaseCounts = useMemo(() => {
    return LEGACY_PHASES.map((phase) => ({
      ...phase,
      rows: rows.filter((row) => row.phaseId === phase.id),
    }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (phaseFilter !== "All" && row.phaseId !== phaseFilter) return false;
      if (statusFilter !== "All" && row.status !== statusFilter) return false;
      if (!q) return true;
      return [
        row.title,
        row.section,
        row.familyPurpose,
        row.goodEnough,
        row.complete,
        row.note,
        row.dependencies.join(" "),
      ].join(" ").toLowerCase().includes(q);
    });

    const sorters: Record<SortMode, (a: typeof next[number], b: typeof next[number]) => number> = {
      priority: (a, b) => a.priority - b.priority || a.phase.order - b.phase.order || a.title.localeCompare(b.title),
      phase: (a, b) => a.phase.order - b.phase.order || a.priority - b.priority || a.title.localeCompare(b.title),
      title: (a, b) => a.title.localeCompare(b.title),
      status: (a, b) => a.status.localeCompare(b.status) || a.priority - b.priority || a.title.localeCompare(b.title),
    };

    return [...next].sort(sorters[sortMode]);
  }, [rows, phaseFilter, statusFilter, sortMode, query]);

  const selected = useMemo(() => {
    return rows.find((row) => row.id === selectedId) || filtered[0] || rows[0];
  }, [rows, filtered, selectedId]);

  function updateStatus(id: string, status: LegacyStatus) {
    const next = { ...statuses, [id]: status };
    setStatuses(next);
    saveJSON(LEGACY_STORAGE_KEYS.statuses, next);
  }

  function updateNote(id: string, value: string) {
    const next = { ...notes, [id]: value };
    setNotes(next);
    saveJSON(LEGACY_STORAGE_KEYS.notes, next);
  }

  function resetSeedBoard() {
    setStatuses(LEGACY_SEED_STATUSES);
    setNotes(LEGACY_SEED_NOTES);
    saveJSON(LEGACY_STORAGE_KEYS.statuses, LEGACY_SEED_STATUSES);
    saveJSON(LEGACY_STORAGE_KEYS.notes, LEGACY_SEED_NOTES);
  }

  function exportMarkdown() {
    downloadTextFile("ODDENGINE_LEGACY_MASTER_CHECKLIST.md", buildLegacyMarkdown(statuses, notes));
  }

  function exportJson() {
    downloadTextFile("ODDENGINE_LEGACY_STATUS_BOARD.json", JSON.stringify(buildLegacyStatusBoard(statuses, notes), null, 2));
  }

  function exportCsv() {
    downloadTextFile("ODDENGINE_LEGACY_ACCEPTANCE_MATRIX.csv", buildLegacyCsv(statuses, notes));
  }

  async function exportZipPack() {
    await downloadZip(
      "OddEngine_Legacy_HQ_Export.zip",
      buildLegacyExportFiles(statuses, notes),
      "OddEngine_Legacy_HQ"
    );
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ maxWidth: 860 }}>
          <div style={{ fontSize: 26, fontWeight: 900 }}>Builder • Legacy HQ</div>
          <div className="small" style={{ marginTop: 6, maxWidth: 820 }}>
            This turns Builder into the master roadmap and acceptance board for the family legacy build. Seed statuses are
            starting assumptions, not a verified audit. The goal is simple: stop guessing, lock what matters, and leave a
            system the family can actually use and maintain.
          </div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button onClick={exportMarkdown}>Export Markdown</button>
          <button onClick={exportJson}>Export JSON</button>
          <button onClick={exportCsv}>Export CSV</button>
          <button onClick={exportZipPack}>Export ZIP pack</button>
          <button className="ghost" onClick={resetSeedBoard}>Reset seed board</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
        <SectionCard title="Overall progress" value={`${summary.progress}%`} sub={`${summary.complete} locked complete out of ${summary.total} tracked items`} />
        <SectionCard title="Critical items" value={String(summary.critical)} sub="Panels or systems that cannot fail quietly" />
        <SectionCard title="Critical still open" value={String(summary.criticalUnsafe)} sub="Critical items not yet locked or complete" />
        <SectionCard title="Needs repair" value={String(summary.repair)} sub="Seeded trouble spots that need stabilization" />
        <SectionCard title="Phases" value={String(LEGACY_PHASES.length)} sub="Survival → front door → legacy → daily ops → money → maintainability → presence" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 12, marginTop: 14 }}>
        <div className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Phase roadmap</div>
          <div style={{ display: "grid", gap: 10 }}>
            {phaseCounts.map((phase) => {
              const done = phase.rows.filter((row) => row.status === "Complete" || row.status === "Locked").length;
              const total = phase.rows.length || 1;
              return (
                <div
                  key={phase.id}
                  className="card"
                  style={{
                    background: phaseFilter === phase.id ? "rgba(22,31,46,0.82)" : "rgba(8,12,18,0.45)",
                    border: phaseFilter === phase.id ? "1px solid rgba(96,165,250,0.55)" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => setPhaseFilter((prev) => prev === phase.id ? "All" : phase.id)}
                >
                  <div className="small" style={{ opacity: 0.8 }}>
                    Phase {phase.order} • {phase.passName}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>{phase.title}</div>
                  <div className="small" style={{ marginTop: 6 }}>{phase.goal}</div>
                  <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", marginTop: 10, overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((done / total) * 100)}%`, height: "100%", background: "rgba(96,165,250,0.75)" }} />
                  </div>
                  <div className="small" style={{ marginTop: 8 }}>{done}/{phase.rows.length} items locked or complete</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Board filters</div>
              <div className="small">Use this as the live build board. Filter, lock, repair, and export.</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
                <option value="All">All phases</option>
                {LEGACY_PHASES.map((phase) => (
                  <option key={phase.id} value={phase.id}>Phase {phase.order} • {phase.title}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}>
                <option value="All">All statuses</option>
                {LEGACY_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
                <option value="priority">Sort by priority</option>
                <option value="phase">Sort by phase</option>
                <option value="title">Sort by title</option>
                <option value="status">Sort by status</option>
              </select>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search panel, purpose, notes…"
                style={{ minWidth: 240 }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 12, marginTop: 14 }}>
            <div className="card" style={{ background: "rgba(8,12,18,0.35)", maxHeight: 980, overflow: "auto" }}>
              <div className="small" style={{ marginBottom: 10, opacity: 0.82 }}>
                {filtered.length} item{filtered.length === 1 ? "" : "s"} shown
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {filtered.map((row) => (
                  <div
                    key={row.id}
                    className="navItem"
                    style={{
                      border: selected?.id === row.id ? "1px solid rgba(96,165,250,0.55)" : "1px solid rgba(255,255,255,0.06)",
                      background: selected?.id === row.id ? "rgba(22,31,46,0.82)" : "rgba(8,12,18,0.35)",
                      padding: 10,
                      borderRadius: 14,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{row.title}</div>
                        <div className="small" style={{ marginTop: 4 }}>
                          Phase {row.phase.order} • {row.section} • Priority {row.priority}
                        </div>
                      </div>
                      <Badge label={row.status} status={row.status} />
                    </div>
                    <div className="small" style={{ marginTop: 8 }}>
                      {row.familyPurpose}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selected && (
              <div className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div>
                    <div className="small" style={{ opacity: 0.75 }}>
                      Phase {selected.phase.order} • {selected.phase.title}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{selected.title}</div>
                    <div className="small" style={{ marginTop: 6, maxWidth: 760 }}>
                      {selected.familyPurpose}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <Badge label={selected.status} status={selected.status} />
                    {selected.critical ? <span className="badge warn">Critical</span> : <span className="badge muted">Non-critical</span>}
                    {selected.safeToFail ? <span className="badge muted">Can fail safely</span> : <span className="badge bad">Cannot fail quietly</span>}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(220px, 1fr))", gap: 10, marginTop: 14 }}>
                  <div className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                    <div className="small">Good enough</div>
                    <div style={{ fontWeight: 700, marginTop: 8 }}>{selected.goodEnough}</div>
                  </div>
                  <div className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                    <div className="small">Complete</div>
                    <div style={{ fontWeight: 700, marginTop: 8 }}>{selected.complete}</div>
                  </div>
                  <div className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                    <div className="small">Dependencies</div>
                    <div style={{ fontWeight: 700, marginTop: 8 }}>
                      {selected.dependencies.length ? selected.dependencies.join(", ") : "None"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, marginTop: 14 }}>
                  <div className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                    <div className="small">Status</div>
                    <select
                      value={selected.status}
                      style={{ marginTop: 10, width: "100%" }}
                      onChange={(e) => updateStatus(selected.id, e.target.value as LegacyStatus)}
                    >
                      {LEGACY_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>

                    <div className="small" style={{ marginTop: 14 }}>Recommended move</div>
                    <div className="small" style={{ marginTop: 8 }}>
                      {selected.critical && selected.status !== "Locked" && selected.status !== "Complete"
                        ? "Critical item not locked yet — keep this in the active build queue."
                        : selected.status === "Needs Repair"
                          ? "Repair before adding more polish."
                          : selected.status === "Not Started"
                            ? "Leave parked until dependencies are stable."
                            : selected.status === "Complete"
                              ? "Confirm it can stay stable after future passes."
                              : "Keep pushing toward locked acceptance criteria."}
                    </div>
                  </div>

                  <div className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                    <div className="small">Builder note</div>
                    <textarea
                      value={selected.note}
                      onChange={(e) => updateNote(selected.id, e.target.value)}
                      style={{ minHeight: 120, width: "100%", marginTop: 10 }}
                      placeholder="Audit note, blocker, dependency, or next pass detail…"
                    />
                  </div>
                </div>

                <div className="card" style={{ background: "rgba(8,12,18,0.35)", marginTop: 14 }}>
                  <div style={{ fontWeight: 900 }}>Acceptance criteria</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {selected.acceptanceCriteria.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.035)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ background: "rgba(8,12,18,0.35)", marginTop: 14 }}>
                  <div style={{ fontWeight: 900 }}>Why this matters for the family</div>
                  <div className="small" style={{ marginTop: 10 }}>
                    {selected.familyPurpose}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
