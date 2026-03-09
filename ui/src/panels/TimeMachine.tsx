import React from "react";
import PanelChrome from "../components/PanelChrome";
import { PHOENIX_WATCHLIST, sniperSummary, topPhoenixSignals } from "../lib/marketDataPhoenix";

type ScenarioTone = "bullish" | "neutral" | "bearish";

type Scenario = {
  title: string;
  odds: number;
  tone: ScenarioTone;
  trigger: string;
  plan: string;
  risk: string;
  lead: string;
};

function marketPosture() {
  const bullish = PHOENIX_WATCHLIST.filter((item) => item.bias === "bullish").length;
  const bearish = PHOENIX_WATCHLIST.filter((item) => item.bias === "bearish").length;
  if (bullish >= bearish + 2) return "Risk-on";
  if (bearish >= bullish + 2) return "Risk-off";
  return "Mixed tape";
}

function buildScenarios(): Scenario[] {
  const [best, second, third] = topPhoenixSignals(3);
  return [
    {
      title: "Momentum continuation",
      odds: 46,
      tone: "bullish",
      trigger: `${best?.symbol || "QQQ"} holds trend and opening pullbacks stay shallow above VWAP.`,
      plan: `Prioritize ${best?.symbol || "QQQ"} and ${second?.symbol || "SPY"} continuation entries with fast trims into extension.`,
      risk: "Failed follow-through after the first reclaim turns the move into chop.",
      lead: best?.symbol || "QQQ",
    },
    {
      title: "Mean reversion flush",
      odds: 32,
      tone: "neutral",
      trigger: `${third?.symbol || "SPY"} loses opening support and leaders fail to expand after the first hour.`,
      plan: "Reduce size, favor quick scalps, and wait for reclaim quality before swinging anything.",
      risk: "Trying to force trend trades inside weak breadth usually bleeds premium fast.",
      lead: third?.symbol || "SPY",
    },
    {
      title: "Late-day squeeze",
      odds: 22,
      tone: "bearish",
      trigger: `${second?.symbol || "HIMS"} basing all day then expanding with volume into power hour.`,
      plan: `Only take it if ${second?.symbol || "HIMS"} is still aligned with sector flow and spread quality is clean.`,
      risk: "This is lower probability and works best with reduced size plus fast profit-taking.",
      lead: second?.symbol || "HIMS",
    },
  ];
}

function toneClass(tone: ScenarioTone) {
  return `timeMachineTone timeMachineTone-${tone}`;
}

export default function TimeMachine() {
  const scenarios = buildScenarios();
  const summary = sniperSummary();
  const best = topPhoenixSignals(1)[0];
  const avgConfidence = Math.round(
    PHOENIX_WATCHLIST.reduce((sum, item) => sum + item.confidence, 0) / Math.max(PHOENIX_WATCHLIST.length, 1),
  );
  const posture = marketPosture();

  return (
    <div className="stack loose">
      <PanelChrome
        title="AI Market Time Machine"
        subtitle="Scenario planner synced to the Phoenix signal lane"
        right={<span className="badge">{posture}</span>}
      />

      <div className="card softCard phoenixPanelCard timeMachineHeroCard">
        <div className="timeMachineHeroTop">
          <div>
            <div className="small shellEyebrow">PREDICTIVE AI</div>
            <div className="h mt-2">⏳ AI Market Time Machine</div>
            <div className="sub mt-3">{summary.note}</div>
          </div>
          <div className="timeMachinePostureBadge">{posture}</div>
        </div>

        <div className="timeMachineMetricsRow">
          <div className="timeMachineMetricTile">
            <div className="timeMachineMetricLabel">Primary setup</div>
            <div className="timeMachineMetricValue">{best?.symbol || "QQQ"}</div>
            <div className="timeMachineMetricSub">{best?.setup || "Trend continuation"}</div>
          </div>
          <div className="timeMachineMetricTile">
            <div className="timeMachineMetricLabel">Avg signal confidence</div>
            <div className="timeMachineMetricValue">{avgConfidence}%</div>
            <div className="timeMachineMetricSub">Keep size honest unless both tape and plan agree.</div>
          </div>
          <div className="timeMachineMetricTile">
            <div className="timeMachineMetricLabel">Best alignment</div>
            <div className="timeMachineMetricValue">{best?.lane || "trend"}</div>
            <div className="timeMachineMetricSub">{best?.catalyst || "Leadership stays sticky."}</div>
          </div>
        </div>
      </div>

      <div className="timeMachineLayoutGrid">
        <div className="card timeMachineScenarioBoard">
          <div className="timeMachineSectionHead">
            <div>
              <div className="small shellEyebrow">SCENARIO BOARD</div>
              <div className="sub mt-2">Run the likely paths before opening risk so the trade has context.</div>
            </div>
            <span className="badge">3 paths</span>
          </div>

          <div className="timeMachineScenarioList">
            {scenarios.map((scenario, idx) => (
              <div key={scenario.title} className="timeMachineScenarioCard">
                <div className="timeMachineScenarioTop">
                  <div className="row tight">
                    <div className="timeMachineScenarioRank">0{idx + 1}</div>
                    <div>
                      <div className="timeMachineScenarioTitle">{scenario.title}</div>
                      <div className="timeMachineScenarioLead">Lead ticker: {scenario.lead}</div>
                    </div>
                  </div>
                  <div className="row tight">
                    <span className={toneClass(scenario.tone)}>{scenario.tone}</span>
                    <span className="badge">{scenario.odds}%</span>
                  </div>
                </div>

                <div className="timeMachineScenarioBody">
                  <div>
                    <div className="timeMachineScenarioLabel">Trigger</div>
                    <div className="timeMachineScenarioText">{scenario.trigger}</div>
                  </div>
                  <div>
                    <div className="timeMachineScenarioLabel">Trade plan</div>
                    <div className="timeMachineScenarioText">{scenario.plan}</div>
                  </div>
                  <div>
                    <div className="timeMachineScenarioLabel">Invalidation / risk</div>
                    <div className="timeMachineScenarioText">{scenario.risk}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card timeMachineReadoutCard">
            <div className="timeMachineSectionHead">
              <div>
                <div className="small shellEyebrow">TRADER READOUT</div>
                <div className="sub mt-2">What the machine is leaning toward right now.</div>
              </div>
              <span className="badge">Live lane</span>
            </div>

            <div className="timeMachineReadoutGrid">
              <div className="timeMachineReadoutTile">
                <div className="timeMachineMetricLabel">Top setup</div>
                <div className="timeMachineReadoutValue">{best?.symbol || "QQQ"}</div>
                <div className="timeMachineReadoutSub">{best?.confidence || 0}% confidence</div>
              </div>
              <div className="timeMachineReadoutTile">
                <div className="timeMachineMetricLabel">Bias</div>
                <div className="timeMachineReadoutValue">{best?.bias || "neutral"}</div>
                <div className="timeMachineReadoutSub">Priority {best?.priority || "B"} • IV {best?.ivRank || 0}</div>
              </div>
              <div className="timeMachineReadoutTile timeMachineReadoutTileWide">
                <div className="timeMachineMetricLabel">What this means for trading</div>
                <div className="timeMachineReadoutSub">
                  Favor entries that align with the current leader, and downgrade size immediately if scenario two starts taking over.
                </div>
              </div>
            </div>
          </div>

          <div className="card timeMachineChecklistCard">
            <div className="small shellEyebrow">EXECUTION CHECKLIST</div>
            <div className="timeMachineChecklist">
              <ul>
                <li>Run the scenario board before pressing size.</li>
                <li>Only swing when Time Machine and Sniper agree on leader and bias.</li>
                <li>Cut risk fast when the active path loses alignment with breadth.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
