import React from "react";
import PanelChrome from "../components/PanelChrome";
import { topPhoenixSignals } from "../lib/marketDataPhoenix";

type Milestone = {
  label: string;
  note: string;
  focus: string;
  size: string;
  checkpoint: string;
};

const milestones: Milestone[] = [
  {
    label: "$50",
    note: "Protect the account before chasing any upside.",
    focus: "1 contract max",
    size: "$5 risk",
    checkpoint: "Only A-grade setups. No averaging down.",
  },
  {
    label: "$100",
    note: "Stay disciplined. The job is surviving enough reps.",
    focus: "A-grade only",
    size: "$6–$8 risk",
    checkpoint: "Take partials early and reset daily.",
  },
  {
    label: "$250",
    note: "Consistency matters more than aggression.",
    focus: "partials + ladders",
    size: "$10–$12 risk",
    checkpoint: "Build a repeatable plan before scaling.",
  },
  {
    label: "$500",
    note: "Scale only with obvious edge and clean structure.",
    focus: "core + runner",
    size: "$15–$20 risk",
    checkpoint: "Cut B-setups. Protect week-to-date gains.",
  },
  {
    label: "$1,000",
    note: "Preserve gains and keep rules intact.",
    focus: "system over hype",
    size: "$20–$30 risk",
    checkpoint: "Size follows data, not emotion.",
  },
];

const rules = [
  "Risk 10% or less of account value per idea.",
  "Only press size when Market Map and Time Machine agree.",
  "Take first partial into strength, then trail the runner.",
  "Two bad trades in a row = step down, reset, review.",
];

export default function FiftyTo1K() {
  const topSignals = topPhoenixSignals(3);
  const lead = topSignals[0];
  const avgConfidence = Math.round(topSignals.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, topSignals.length));
  const marketPosture = lead?.bias === "bearish" ? "Selective / defensive" : lead?.bias === "neutral" ? "Mixed / patient" : "Constructive / trend friendly";

  return (
    <div className="stack loose">
      <PanelChrome
        title="$50 → $1k Dashboard"
        subtitle="Small-account sniper structure built around account survival first"
        right={<span className="badge good">Default risk / trade $5</span>}
      />

      <div className="card softCard phoenixPanelCard fiftyHeroCard">
        <div className="small shellEyebrow">SMALL ACCOUNT COACH</div>
        <div className="fiftyHeroTop">
          <div>
            <div className="h" style={{ marginTop: 6 }}>💰 $50 → $1k Dashboard</div>
            <div className="sub" style={{ marginTop: 8 }}>
              Trade the account you actually have, not the one you wish you had. Stack disciplined A-setups, protect the downside,
              and let compounding do the heavy lifting.
            </div>
          </div>
          <div className="fiftyPostureBadge">{marketPosture}</div>
        </div>

        <div className="fiftyMetricsRow">
          <div className="fiftyMetricTile">
            <div className="fiftyMetricLabel">Today&apos;s best alignment</div>
            <div className="fiftyMetricValue">{lead?.symbol ?? "Watch"}</div>
            <div className="fiftyMetricSub">{lead ? `${lead.setup} • ${lead.confidence}% confidence • ${lead.priority}-grade` : "Wait for clean structure."}</div>
          </div>
          <div className="fiftyMetricTile">
            <div className="fiftyMetricLabel">Small-account posture</div>
            <div className="fiftyMetricValue">Protect capital</div>
            <div className="fiftyMetricSub">No hero trades. Size only when your edge is obvious.</div>
          </div>
          <div className="fiftyMetricTile">
            <div className="fiftyMetricLabel">Avg signal confidence</div>
            <div className="fiftyMetricValue">{avgConfidence}%</div>
            <div className="fiftyMetricSub">Use the Phoenix lane as a filter, not an excuse to force a trade.</div>
          </div>
        </div>
      </div>

      <div className="fiftyLayoutGrid">
        <div className="card fiftyBoardCard">
          <div className="fiftySectionHead">
            <div>
              <div className="small shellEyebrow">MILESTONE LADDER</div>
              <div className="sub" style={{ marginTop: 6 }}>Each stage has one job: stay alive long enough to earn the next size tier.</div>
            </div>
            <span className="badge">5 stages</span>
          </div>

          <div className="fiftyLadderList">
            {milestones.map((m, index) => (
              <div key={m.label} className="fiftyLadderRow">
                <div className="fiftyLadderRank">{index + 1}</div>
                <div className="fiftyLadderBody">
                  <div className="fiftyLadderTop">
                    <div>
                      <div className="fiftyLadderLabel">{m.label}</div>
                      <div className="fiftyLadderMeta">{m.focus} • {m.size}</div>
                    </div>
                    <span className="badge">Checkpoint</span>
                  </div>
                  <div className="fiftyLadderNote">{m.note}</div>
                  <div className="fiftyLadderCheckpoint">{m.checkpoint}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="stack tight">
          <div className="card fiftyReadoutCard">
            <div className="small shellEyebrow">TODAY&apos;S EXECUTION READOUT</div>
            <div className="fiftyReadoutGrid">
              <div className="fiftyReadoutTile">
                <div className="fiftyReadoutLabel">Risk budget</div>
                <div className="fiftyReadoutValue">$5</div>
                <div className="fiftyReadoutSub">Default starter size until momentum and discipline both prove themselves.</div>
              </div>
              <div className="fiftyReadoutTile">
                <div className="fiftyReadoutLabel">Best ticker</div>
                <div className="fiftyReadoutValue">{lead?.symbol ?? "Watch"}</div>
                <div className="fiftyReadoutSub">{lead?.catalyst ?? "Wait for the tape to show its hand."}</div>
              </div>
              <div className="fiftyReadoutTile">
                <div className="fiftyReadoutLabel">First target</div>
                <div className="fiftyReadoutValue">+20% to +25%</div>
                <div className="fiftyReadoutSub">Get paid early. Let the runner earn the right to stay alive.</div>
              </div>
            </div>
          </div>

          <div className="card fiftyRulesCard">
            <div className="small shellEyebrow">ACCOUNT PROTECTION RULES</div>
            <div className="fiftyRulesList">
              {rules.map((rule) => (
                <div key={rule} className="fiftyRuleItem">{rule}</div>
              ))}
            </div>
          </div>

          <div className="card fiftyFocusCard">
            <div className="small shellEyebrow">NEXT SIZE-UP CHECKLIST</div>
            <div className="fiftyFocusList">
              <div className="fiftyFocusItem">
                <b>1. Build plan first</b>
                <div className="small" style={{ marginTop: 5 }}>Use Sniper Terminal to define entry, stop, and first partial before clicking size.</div>
              </div>
              <div className="fiftyFocusItem">
                <b>2. Confirm alignment</b>
                <div className="small" style={{ marginTop: 5 }}>Only scale when Market Map leadership and Time Machine scenario both support the same direction.</div>
              </div>
              <div className="fiftyFocusItem">
                <b>3. Respect the reset</b>
                <div className="small" style={{ marginTop: 5 }}>If you lose emotional clarity, the next trade is review mode, not revenge mode.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
