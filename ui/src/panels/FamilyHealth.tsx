import React, { useEffect, useMemo, useState } from "react";
import { acknowledgePanelAction, getPanelActions, PANEL_ACTION_EVENT } from "../lib/brain";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { FeedItem, TRUSTED_HEALTH_LINKS, fetchPubMed, openExternalLink } from "../lib/webData";
import PluginMiniWidgets from "../components/PluginMiniWidgets";
import { UPGRADE_PACKS_EVENT, getUpgradePackStatus, isUpgradePackInstalled } from "../lib/plugins";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent, fmtDate } from "../lib/calendarStore";

type Member = {
  id: string;
  name: string;
  age: string;
  allergies: string;
  meds: string;
  conditions: string;
  notes: string;
  researchQuery: string;
  nextVisit: string;
  vitals: string;
  lastResearch?: FeedItem[];
  doctorQuestions?: string[];
  timeline?: Array<{ ts: number; note: string }>;
  appointmentPrep?: string;
  researchSummary?: string;
  followUpChecklist?: string[];
};

type FamilyHealthState = {
  activeId: string;
  members: Member[];
  careBrief: string;
  disclaimerAccepted: boolean;
  lastUpdated?: number;
};

const KEY = "oddengine:familyHealth:v1";
function uid() { return `member_${Math.random().toString(36).slice(2, 9)}`; }
function blankMember(name = "Family member"): Member {
  return {
    id: uid(),
    name,
    age: "",
    allergies: "",
    meds: "",
    conditions: "",
    notes: "",
    researchQuery: "",
    nextVisit: "",
    vitals: "",
    lastResearch: [],
    doctorQuestions: [],
    timeline: [],
    appointmentPrep: "",
    researchSummary: "",
    followUpChecklist: [],
  };
}
const defaultState: FamilyHealthState = { activeId: "", members: [blankMember("Mom")], careBrief: "", disclaimerAccepted: false };

function ensureMemberShape(member: Member): Member {
  return { ...blankMember(member.name || "Family member"), ...member };
}

function buildDoctorQuestions(member: Member) {
  const questions: string[] = [];
  if (member.conditions) questions.push(`How should we monitor ${member.conditions} week to week?`);
  if (member.meds) questions.push(`Are there interactions or timing issues with ${member.meds}?`);
  if (member.allergies) questions.push(`Do ${member.allergies} change medication or food recommendations?`);
  if (member.vitals) questions.push(`Which numbers or symptoms from these vitals/notes matter most: ${member.vitals}?`);
  if (member.notes) questions.push(`What should we watch closely based on these notes: ${member.notes.slice(0, 90)}${member.notes.length > 90 ? "…" : ""}?`);
  questions.push("What changes would mean we should call sooner or seek urgent care?");
  questions.push("What simple next steps or home-monitoring habits would help before the next visit?");
  return questions;
}

function buildFollowUps(member: Member) {
  const items: string[] = [];
  if (member.nextVisit) items.push(`Bring this sheet to the next visit on or around ${member.nextVisit}.`);
  if (member.meds) items.push("Review medication timing, refill timing, and any side-effect notes before the visit.");
  if (member.conditions || member.notes) items.push("Track any changes in symptoms, routines, appetite, sleep, and energy until the next check-in.");
  items.push("Escalate urgent or severe symptoms to a clinician or emergency services instead of waiting on this panel.");
  return items;
}

function summarizeResearchItems(items: FeedItem[]) {
  if (!items.length) return "No research summary yet. Run the trusted-source research helper first.";
  const leads = items.slice(0, 3).map((item, idx) => `${idx + 1}. ${item.title}${item.publishedAt ? ` (${item.publishedAt})` : ""}`).join("\n");
  return `Top literature notes:\n${leads}\n\nUse these papers to inform better questions for a clinician, not to self-diagnose.`;
}

export default function FamilyHealth({ onNavigate, onOpenHowTo }: { onNavigate?: (id: string) => void; onOpenHowTo?: () => void } = {}) {
  const [state, setState] = useState<FamilyHealthState>(() => {
    const saved = loadJSON<FamilyHealthState>(KEY, defaultState);
    const members = (saved.members || defaultState.members).map(ensureMemberShape);
    return { ...saved, members, activeId: saved.activeId || members[0]?.id || "" };
  });
  const [busy, setBusy] = useState(false);
  const [pluginTick, setPluginTick] = useState(0);
  const [timelineDraft, setTimelineDraft] = useState("");
  const active = useMemo(() => state.members.find((m) => m.id === state.activeId) || state.members[0], [state]);
  const hasResearchPack = isUpgradePackInstalled("family-health-research-pack");
  const researchPackStatus = getUpgradePackStatus("family-health-research-pack");
  const permissionsReady = hasResearchPack && !researchPackStatus.missingPermissions.length;

  function persist(next: FamilyHealthState) {
    setState(next);
    saveJSON(KEY, next);
  }

  function patchActive(patch: Partial<Member>) {
    if (!active) return;
    const nextMembers = state.members.map((m) => {
      if (m.id !== active.id) return m;
      const timeline = [...(m.timeline || [])];
      if (typeof patch.notes === "string" && patch.notes !== m.notes && patch.notes.trim()) {
        timeline.push({ ts: Date.now(), note: patch.notes.trim() });
      }
      return { ...m, ...patch, timeline };
    });
    persist({ ...state, members: nextMembers, lastUpdated: Date.now() });
  }

  function addTimelineEntry(note = timelineDraft.trim()) {
    if (!active || !note) return;
    patchActive({ timeline: [...(active.timeline || []), { ts: Date.now(), note }] });
    setTimelineDraft("");
  }

  function addMember() {
    const member = blankMember(`Family member ${state.members.length + 1}`);
    persist({ ...state, members: [...state.members, member], activeId: member.id, lastUpdated: Date.now() });
  }

  function removeActive() {
    if (!active || state.members.length <= 1) return;
    const members = state.members.filter((m) => m.id !== active.id);
    persist({ ...state, members, activeId: members[0]?.id || "", lastUpdated: Date.now() });
  }

  async function runResearch(queryOverride?: string) {
    if (!active || !permissionsReady || !state.disclaimerAccepted) return;
    const term = (queryOverride || active.researchQuery || `${active.name} ${active.conditions || active.notes}`).trim();
    if (!term) return;
    setBusy(true);
    try {
      const items = await fetchPubMed(term, 6);
      patchActive({ researchQuery: term, lastResearch: items, researchSummary: summarizeResearchItems(items) });
    } finally {
      setBusy(false);
    }
  }

  function buildCareBrief() {
    if (!active) return;
    const brief = [
      `${active.name}${active.age ? ` • Age ${active.age}` : ""}`,
      active.conditions ? `Conditions: ${active.conditions}` : "Conditions: none noted",
      active.allergies ? `Allergies: ${active.allergies}` : "Allergies: none noted",
      active.meds ? `Meds: ${active.meds}` : "Meds: none noted",
      active.vitals ? `Vitals / home readings: ${active.vitals}` : "Vitals / home readings: none noted",
      active.nextVisit ? `Next visit: ${active.nextVisit}` : "Next visit: not set",
      active.notes ? `Notes: ${active.notes}` : "Notes: no additional notes",
      "This panel is for organization and education only. For emergencies or urgent symptoms, call a clinician or emergency services.",
    ].join("\n");
    persist({ ...state, careBrief: brief, lastUpdated: Date.now() });
  }

  function buildQuestions() {
    if (!active) return;
    patchActive({ doctorQuestions: buildDoctorQuestions(active), followUpChecklist: buildFollowUps(active) });
  }

  function buildPrepSheet() {
    if (!active) return;
    const questions = active.doctorQuestions?.length ? active.doctorQuestions : buildDoctorQuestions(active);
    const prep = [
      `Appointment prep for ${active.name}`,
      active.nextVisit ? `Visit date: ${active.nextVisit}` : "Visit date: not set",
      active.conditions ? `Main conditions / concerns: ${active.conditions}` : "Main conditions / concerns: list the main concern to discuss",
      active.meds ? `Current meds: ${active.meds}` : "Current meds: none recorded",
      active.allergies ? `Allergies: ${active.allergies}` : "Allergies: none recorded",
      active.vitals ? `Vitals / home readings: ${active.vitals}` : "Vitals / home readings: none recorded",
      active.notes ? `Recent observations: ${active.notes}` : "Recent observations: add any symptom changes, appetite, sleep, mobility, or mood notes",
      "Questions to ask:",
      ...questions.map((q) => `- ${q}`),
    ].join("\n");
    patchActive({ appointmentPrep: prep, doctorQuestions: questions, followUpChecklist: buildFollowUps(active) });
  }

  function summarizeResearch() {
    if (!active) return;
    patchActive({ researchSummary: summarizeResearchItems(active.lastResearch || []) });
  }

  useEffect(() => {
    const pluginHandler = () => setPluginTick((v) => v + 1);
    window.addEventListener(UPGRADE_PACKS_EVENT, pluginHandler as EventListener);
    return () => window.removeEventListener(UPGRADE_PACKS_EVENT, pluginHandler as EventListener);
  }, []);

  useEffect(() => {
    const handler = () => {
      for (const action of getPanelActions("FamilyHealth")) {
        if (action.actionId === "family-health:research") runResearch();
        if (action.actionId === "family-health:build-questions") buildQuestions();
        if (action.actionId === "family-health:build-prep") buildPrepSheet();
        if (action.actionId === "family-health:summarize-research") summarizeResearch();
        acknowledgePanelAction(action.id);
      }
    };
    handler();
    window.addEventListener(PANEL_ACTION_EVENT, handler as EventListener);
    return () => window.removeEventListener(PANEL_ACTION_EVENT, handler as EventListener);
  }, [state, permissionsReady, pluginTick]);

  const householdStats = useMemo(() => {
    const members = state.members || [];
    const researchCount = members.reduce((sum, member) => sum + (member.lastResearch?.length || 0), 0);
    const prepCount = members.filter((member) => member.appointmentPrep).length;
    return { memberCount: members.length, researchCount, prepCount };
  }, [state.members]);

  return (
    <div className="page">
      <PanelHeader
        panelId="FamilyHealth"
        title="🩺 Family Health"
        subtitle="Care briefs, appointment prep, and trusted research lane."
        storagePrefix="oddengine:familyHealth"
        storageActionsMode="menu"
        badges={[
          { label: state.disclaimerAccepted ? "Research unlocked" : "Accept disclaimer", tone: state.disclaimerAccepted ? "good" : "warn" },
          { label: hasResearchPack ? (permissionsReady ? "Research pack ready" : "Research pack needs permissions") : "Research pack not installed", tone: hasResearchPack ? (permissionsReady ? "good" : "warn") : "muted" },
          { label: `${state.members.length} family tabs`, tone: state.members.length ? "good" : "muted" },
          { label: `${householdStats.prepCount} prep sheets`, tone: householdStats.prepCount ? "good" : "muted" },
        ]}
        rightSlot={
          <ActionMenu
            title="Health tools"
            items={[
              { label: "Open Calendar", onClick: () => onNavigate?.("Calendar") },
              { label: "Add appointment", onClick: () => { const d = prompt("Date (YYYY-MM-DD)", fmtDate(new Date())); if(!d) return; addQuickEvent({ title: "Family Health: appointment", panelId: "FamilyHealth", date: d, notes: "Add doctor + questions + meds list." }); } },
              { label: "Add refill reminder", onClick: () => { const d = prompt("Date (YYYY-MM-DD)", fmtDate(new Date())); if(!d) return; addQuickEvent({ title: "Family Health: med refill", panelId: "FamilyHealth", date: d, notes: "Check meds, refills, pharmacy." }); } },
            ]}
          />
        }
      />

      <PanelScheduleCard
        panelId="FamilyHealth"
        title="Health schedule"
        subtitle="Quick-add care reminders + upcoming items."
        presets={[
          { label: "+ Appointment", title: "Family Health: appointment", notes: "Bring meds list + questions." },
          { label: "+ Refill", title: "Family Health: med refill", offsetDays: 7, notes: "Call pharmacy / check refills." },
          { label: "+ Lab results", title: "Family Health: review lab results", offsetDays: 1, notes: "Review results and notes; update care brief." },
          { label: "+ Check-in", title: "Family Health: weekly check-in", offsetDays: 7, notes: "Update vitals, symptoms, and next steps." },
        ]}
        onNavigate={onNavigate}
      />


      <PluginMiniWidgets panelId="FamilyHealth" onNavigate={onNavigate} onOpenHowTo={onOpenHowTo} />

      <div className="grid2 familyHealthHeroGrid" style={{ alignItems: "start" }}>
        <div className="card softCard familyHealthHeroCard">
          <div className="small shellEyebrow">FAMILY CARE COMMAND</div>
          <div className="familyHealthHeroTitle">Household overview</div>
          <div className="sub familyHealthHeroSub">Keep each person’s care brief, visit prep, timeline, and trusted-source research in one calm command lane.</div>
          <div className="familyHealthMetricStrip" style={{ marginTop: 12 }}>
            <div className="familyHealthMetricCard">
              <div className="small shellEyebrow">MEMBERS</div>
              <div className="familyHealthMetricValue">{householdStats.memberCount}</div>
            </div>
            <div className="familyHealthMetricCard">
              <div className="small shellEyebrow">RESEARCH</div>
              <div className="familyHealthMetricValue">{householdStats.researchCount}</div>
            </div>
            <div className="familyHealthMetricCard">
              <div className="small shellEyebrow">PREP SHEETS</div>
              <div className="familyHealthMetricValue">{householdStats.prepCount}</div>
            </div>
            <div className="familyHealthMetricCard">
              <div className="small shellEyebrow">STATUS</div>
              <div className="familyHealthMetricValue small">{state.careBrief ? "Brief ready" : "Build brief"}</div>
            </div>
          </div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            <span className="badge good">{householdStats.memberCount} members</span>
            <span className="badge">{householdStats.researchCount} research items</span>
            <span className={`badge ${state.careBrief ? "good" : "warn"}`}>{state.careBrief ? "Care brief ready" : "No care brief yet"}</span>
            <span className={`badge ${active?.nextVisit ? "warn" : "muted"}`}>{active?.nextVisit ? `Next visit ${active.nextVisit}` : "No visit scheduled"}</span>
          </div>
          <div className="timelineCard familyHealthBriefCard" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
            {state.careBrief || "Build a care brief to keep appointments, meds, conditions, and family updates portable."}
          </div>
        </div>

        <div className="card softCard familyHealthTrustCard">
          <div className="small shellEyebrow">TRUSTED-SOURCE LANE</div>
          <div className="h">Research + prep tools</div>
          <div className="sub" style={{ marginTop: 6 }}>Use trusted links, accept the guardrail, then generate a brief, questions, and prep sheet for the active family member.</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {TRUSTED_HEALTH_LINKS.map((link) => <button key={link.label} className="tabBtn" onClick={() => openExternalLink(link.url)}>{link.label}</button>)}
          </div>
          <label className="row familyHealthDisclaimerRow" style={{ marginTop: 12, alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={state.disclaimerAccepted} onChange={(e) => persist({ ...state, disclaimerAccepted: e.target.checked, lastUpdated: Date.now() })} />
            <span className="small">I understand this panel is educational and organizational only, not a substitute for clinical diagnosis or emergency care.</span>
          </label>
          {!hasResearchPack && <div className="small familyHealthWarn" style={{ marginTop: 10, color: "var(--warn)" }}>Install the Family Health Research Pack from Plugins to unlock prep sheets, trusted-source research, and doctor-question builder.</div>}
          {hasResearchPack && !permissionsReady && <div className="small familyHealthWarn" style={{ marginTop: 10, color: "var(--warn)" }}>Family Health Research Pack is installed but still needs source permissions in the Plugin panel.</div>}
          <div className="row familyHealthActionRow" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn active" onClick={buildCareBrief}>Build care brief</button>
            {hasResearchPack && <button className="tabBtn" onClick={buildQuestions}>Build doctor questions</button>}
            {hasResearchPack && <button className="tabBtn" onClick={buildPrepSheet}>Build prep sheet</button>}
          </div>
        </div>
      </div>

      <div className="spotlightGrid familyHealthFollowupGrid">
        <div className="card spotlightCard familyHealthFollowupCard">
          <div className="small shellEyebrow">ACTIVE MEMBER FOCUS</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{active?.name || "No active member"}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>{active?.nextVisit ? `Next visit ${active.nextVisit}. Use the prep sheet and questions lane to walk in organized.` : "Set the next visit date, then build questions and a prep sheet so the care lane is ready before the appointment."}</div>
        </div>
        <div className="card spotlightCard familyHealthFollowupCard">
          <div className="small shellEyebrow">CARE PLAYBOOK</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{state.disclaimerAccepted ? "Research lane unlocked" : "Accept the care guardrail"}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>{permissionsReady ? "Trusted-source research, summaries, and prep sheets are ready to support the active family member." : "The calmest next move is brief → questions → prep sheet, with trusted-source research only after the guardrails and permissions are ready."}</div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard familyHealthMemberCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="small shellEyebrow">CARE TABS</div>
              <div className="h">Family member tabs</div>
              <div className="sub">Keep one structured tab per person.</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={addMember}>Add member</button>
              <button className="tabBtn" onClick={removeActive} disabled={state.members.length <= 1}>Remove active</button>
            </div>
          </div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {state.members.map((member) => (
              <button key={member.id} className={`tabBtn ${member.id === active?.id ? "active" : ""}`} onClick={() => persist({ ...state, activeId: member.id })}>{member.name}</button>
            ))}
          </div>
          {active && (
            <div className="assistantStack" style={{ marginTop: 12 }}>
              <label className="field">Name<input value={active.name} onChange={(e) => patchActive({ name: e.target.value })} /></label>
              <div className="grid2">
                <label className="field">Age<input value={active.age} onChange={(e) => patchActive({ age: e.target.value })} placeholder="74" /></label>
                <label className="field"><div className="row" style={{justifyContent:"space-between", alignItems:"center", gap:8}}><span>Next visit</span><button className="tabBtn" onClick={() => { const d = (active.nextVisit || "").trim() || prompt("Date (YYYY-MM-DD)", fmtDate(new Date())) || ""; if(!d) return; addQuickEvent({ title: `Appointment: ${active.name}`, panelId: "FamilyHealth", date: d, notes: "Bring meds list + questions." }); pushNotif({ title: "Family Health", body: "Added appointment to Calendar.", tags: ["FamilyHealth"], level: "good" as any }); }}>+Cal</button></div><input value={active.nextVisit} onChange={(e) => patchActive({ nextVisit: e.target.value })} placeholder="2026-03-12" /></label>
              </div>
              <label className="field">Conditions<input value={active.conditions} onChange={(e) => patchActive({ conditions: e.target.value })} placeholder="high blood pressure, arthritis" /></label>
              <label className="field">Allergies<input value={active.allergies} onChange={(e) => patchActive({ allergies: e.target.value })} placeholder="penicillin, shellfish" /></label>
              <label className="field">Meds<input value={active.meds} onChange={(e) => patchActive({ meds: e.target.value })} placeholder="lisinopril, vitamin D" /></label>
              <label className="field">Vitals / home readings<input value={active.vitals} onChange={(e) => patchActive({ vitals: e.target.value })} placeholder="BP 128/80, O2 97%, temp 98.6" /></label>
              <label className="field">Notes<textarea rows={5} value={active.notes} onChange={(e) => patchActive({ notes: e.target.value })} placeholder="Symptoms, appointment notes, concerns, home observations…" /></label>
            </div>
          )}
        </div>

        <div className="card softCard familyHealthPrepCard">
          <div className="small shellEyebrow">VISIT READINESS</div>
          <div className="h">Doctor visit prep</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            <div className="timelineCard" style={{ whiteSpace: "pre-wrap" }}>{active?.appointmentPrep || "Build a prep sheet to turn this member tab into an appointment-ready summary."}</div>
            {hasResearchPack && (
              <>
                <div className="assistantSectionTitle">Follow-up checklist</div>
                {(active?.followUpChecklist || []).map((item, idx) => <div key={idx} className="timelineCard">{item}</div>)}
                {!(active?.followUpChecklist || []).length && <div className="small">Build doctor questions or a prep sheet to generate a practical follow-up checklist.</div>}
              </>
            )}
          </div>
        </div>
      </div>

      {hasResearchPack && (
        <div className="grid2" style={{ alignItems: "start" }}>
          <div className="card softCard familyHealthQuestionCard">
            <div className="small shellEyebrow">QUESTION BUILDER</div>
            <div className="h">Doctor questions</div>
            <div className="assistantStack" style={{ marginTop: 10 }}>
              {(active?.doctorQuestions || []).map((q, idx) => <div key={idx} className="timelineCard">{q}</div>)}
              {!(active?.doctorQuestions || []).length && <div className="small">Build doctor questions from the active member tab.</div>}
            </div>
          </div>
          <div className="card softCard familyHealthTimelineCard">
            <div className="small shellEyebrow">OBSERVATION LOG</div>
            <div className="h">Timeline</div>
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <input value={timelineDraft} onChange={(e) => setTimelineDraft(e.target.value)} placeholder="Add a quick timeline note…" />
              <button className="tabBtn active" onClick={() => addTimelineEntry()}>Add</button>
            </div>
            <div className="assistantStack" style={{ marginTop: 10 }}>
              {(active?.timeline || []).slice().reverse().slice(0, 8).map((entry, idx) => (
                <div key={`${entry.ts}_${idx}`} className="timelineCard">
                  <div className="small">{new Date(entry.ts).toLocaleString()}</div>
                  <div style={{ marginTop: 6 }}>{entry.note}</div>
                </div>
              ))}
              {!(active?.timeline || []).length && <div className="small">Changes to notes and quick timeline entries will show up here.</div>}
            </div>
          </div>
        </div>
      )}

      {active && (
        <div className="card softCard familyHealthResearchCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="h">Research helper</div>
              <div className="sub">Use a condition, symptom combo, or medication topic. Results are educational literature links, not treatment instructions.</div>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => runResearch()} disabled={busy || !state.disclaimerAccepted || !permissionsReady}>{busy ? "Researching…" : "Run research"}</button>
              {hasResearchPack && <button className="tabBtn" onClick={summarizeResearch}>Summarize research</button>}
            </div>
          </div>
          <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
            <label className="field" style={{ flex: 1 }}>Research query
              <input value={active.researchQuery} onChange={(e) => patchActive({ researchQuery: e.target.value })} placeholder="Example: hypertension older adult diet medication interactions" />
            </label>
          </div>
          {hasResearchPack && <div className="timelineCard" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{active.researchSummary || "Run research and summarize it here into a short trusted-source note."}</div>}
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {(active.lastResearch || []).map((item) => (
              <div key={item.id} className="timelineCard">
                <div className="small">{item.source || "PubMed"}{item.publishedAt ? ` • ${item.publishedAt}` : ""}</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{item.title}</div>
                {item.summary && <div className="small" style={{ marginTop: 6 }}>{item.summary}</div>}
                <div className="row" style={{ marginTop: 8, gap: 8 }}>
                  <button className="tabBtn" onClick={() => openExternalLink(item.link)}>Open paper</button>
                </div>
              </div>
            ))}
            {!(active.lastResearch || []).length && <div className="small">No research results yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}