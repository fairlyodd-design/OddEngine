import React, { useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import CardFrame from "../components/CardFrame";
import { loadJSON } from "../lib/storage";
import { listPublisherJobs, runPublisherJob, createPublisherJob } from "../lib/publisherEngine";
import { listOutcomes, summarizeOutcomes, addOutcome } from "../lib/outcomeTracker";
import { buildLearningSummary } from "../lib/learningEngine";
import { buildMoneyAutopilotPlan, getMoneyAutopilotSettings, runMoneyAutopilotAction, saveMoneyAutopilotSettings } from "../lib/moneyAutopilot";
import { listSecrets, saveSecret, maskedSecret } from "../lib/secretsVault";
import { autoDraftListingsFromWinners, listCommerceListings, publishCommerceListing } from "../lib/commerceEngine";
import { createPublisherJobFromMusicRelease, getLatestMusicRelease } from "../lib/musicRelease";

const KEY_RENDER_JOBS = "oddengine:renderlab:jobs:v1";

type RenderJob = { id: string; title: string; type: string; status: string; handoff?: any; publishTargets?: string[] };

export default function PublisherHub({ onNavigate }: { onNavigate: (panelId: string) => void }) {
  const [jobs, setJobs] = useState(() => listPublisherJobs());
  const [platform, setPlatform] = useState("youtube");
  const [secretValue, setSecretValue] = useState("");
  const [metricJobId, setMetricJobId] = useState("");
  const [views, setViews] = useState("500");
  const [clicks, setClicks] = useState("25");
  const [conversions, setConversions] = useState("2");
  const [revenue, setRevenue] = useState("15");
  const [autopilotTick, setAutopilotTick] = useState(0);
  const [dropHot, setDropHot] = useState(false);
  const [dropMsg, setDropMsg] = useState("");

  const renderJobs = loadJSON<RenderJob[]>(KEY_RENDER_JOBS, []);
  const outcomes = listOutcomes();
  const totals = summarizeOutcomes();
  const learning = buildLearningSummary();
  const secrets = listSecrets();
  const listings = listCommerceListings();
  void autopilotTick;
  const autopilot = buildMoneyAutopilotPlan();
  const autopilotSettings = getMoneyAutopilotSettings();

  const readyRenderJobs = useMemo(() => renderJobs.filter((job) => ["packaging", "published"].includes(String(job.status || ""))), [renderJobs]);

  const refresh = () => {
    setJobs(listPublisherJobs());
    setAutopilotTick((x) => x + 1);
  };

  const createFromRender = (job: RenderJob) => {
    createPublisherJob({ sourceId: job.id, sourceTitle: job.title, contentType: job.type || "asset", targets: job.publishTargets || job.handoff?.distribution?.targets || ["local"], autoPublish: true, payload: { renderJob: job } });
    refresh();
  };

  const latestMusicRelease = getLatestMusicRelease();

  const handleMusicReleaseDrop = (raw: string | null | undefined) => {
    if (!raw) {
      setDropMsg('Drop failed: no release payload found.');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const release = parsed?.release || parsed;
      if (!release?.folder) {
        setDropMsg('Drop failed: release payload missing folder.');
        return;
      }
      createPublisherJobFromMusicRelease(release);
      setDropMsg(`Music release queued: ${release.title || release.folder}`);
      refresh();
    } catch (e: any) {
      setDropMsg(`Drop failed: ${e?.message || String(e)}`);
    }
  };

  return (
    <div className="panelRoot">
      <PanelHeader
        title="🚀 Publisher Hub"
        subtitle="Auto publish queue, token vault, money outcomes, and learning loop."
        panelId="PublisherHub"
        storagePrefix="oddengine:publisherhub"
        showCopilot
      />

      <div className="writersGrid">
        <div className="writersLeft">
          <CardFrame title="Auto publish intake" subtitle="Pull finished render jobs into the publish queue" storageKey="publisher:intake" className="softCard">
            <div
              className={`studioPipelineCard ${dropHot ? 'dropZoneHot' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDropHot(true); e.dataTransfer.dropEffect = 'copy'; }}
              onDragLeave={() => setDropHot(false)}
              onDrop={(e) => { e.preventDefault(); setDropHot(false); handleMusicReleaseDrop(e.dataTransfer.getData('application/json')); }}
            >
              <div className="h">Drop final music release here</div>
              <div className="small mt-2">Drag the release card from Music Lab or use the quick queue button below.</div>
              <div className="row wrap mt-4">
                <button className="tabBtn" onClick={() => { if (!latestMusicRelease) { setDropMsg('No saved Music Lab release yet. Merge a final release first.'); return; } createPublisherJobFromMusicRelease(latestMusicRelease); setDropMsg(`Music release queued: ${latestMusicRelease.title}`); refresh(); }}>Queue latest Music Lab release</button>
              </div>
              {latestMusicRelease ? <div className="small mt-4">Latest release: {latestMusicRelease.title} • {latestMusicRelease.folder}</div> : null}
              {dropMsg ? <div className="small mt-4">{dropMsg}</div> : null}
            </div>
            <div className="grid mt-4">
              {readyRenderJobs.length === 0 ? <div className="small">No packaging-ready render jobs yet.</div> : readyRenderJobs.map((job) => (
                <div key={job.id} className="cluster spread">
                  <div>
                    <div><b>{job.title}</b></div>
                    <div className="small">{job.type} • {job.status}</div>
                  </div>
                  <button className="tabBtn" onClick={() => createFromRender(job)}>Queue publish</button>
                </div>
              ))}
            </div>
            <div className="row wrap mt-4">
              <button className="tabBtn" onClick={() => onNavigate("RenderLab")}>Open Render Lab</button>
              <button className="tabBtn" onClick={() => onNavigate("Books")}>Open Studio</button>
              <button className="tabBtn" onClick={() => onNavigate("IncomeAutopilot")}>Open Income Autopilot</button>
            </div>
          </CardFrame>

          <CardFrame title="OAuth + token vault" subtitle="oddengine:secrets:v1" storageKey="publisher:secrets" className="softCard">
            <div className="studioInlineSelect">
              <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="x">X</option>
                <option value="gumroad">Gumroad</option>
                <option value="etsy">Etsy</option>
                <option value="stripe">Stripe</option>
                <option value="local">Local export</option>
              </select>
              <input className="input" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} placeholder="API key / token / endpoint" />
              <button className="tabBtn" onClick={() => { saveSecret(platform, { apiKey: secretValue, accessToken: secretValue, endpoint: secretValue.startsWith("http") ? secretValue : "" }); setSecretValue(""); refresh(); }}>Save</button>
            </div>
            <div className="grid mt-4">
              {secrets.length === 0 ? <div className="small">No saved platform credentials yet.</div> : secrets.map((item) => (
                <div key={item.platform} className="cluster spread"><span>{item.platform}</span><span className="small">{maskedSecret(item.apiKey || item.accessToken || item.endpoint)}</span></div>
              ))}
            </div>
          </CardFrame>
        </div>

        <div className="writersCenter">
          <CardFrame title="Publish queue" subtitle="The OS creates → publishes → learns → improves → repeats." storageKey="publisher:queue" className="softCard">
            <div className="grid">
              {jobs.length === 0 ? <div className="small">No publish jobs queued yet.</div> : jobs.map((job) => (
                <div key={job.id} className="studioPipelineCard">
                  <div className="cluster spread">
                    <div>
                      <div className="h">{job.sourceTitle}</div>
                      <div className="small">{job.contentType} • {job.autoPublish ? "full auto" : "assisted"}</div>
                    </div>
                    <button className="tabBtn" onClick={() => { runPublisherJob(job.id); refresh(); }}>Run publish</button>
                  </div>
                  <div className="studioPillRow mt-4">
                    {job.targets.map((t) => <span key={t.platform} className="studioPill">{t.platform}: {t.status}</span>)}
                  </div>
                  <pre className="mt-4">{(job.logs || []).slice(0, 6).join("\n")}</pre>
                </div>
              ))}
            </div>
          </CardFrame>

          <CardFrame title="Money outcomes" subtitle="oddengine:money:outcomes:v1" storageKey="publisher:money" className="softCard">
            <div className="studioPipelineGrid">
              <div className="studioPipelineCard"><div className="small">Revenue</div><div className="h">${totals.revenue.toFixed(2)}</div></div>
              <div className="studioPipelineCard"><div className="small">Views</div><div className="h">{totals.views}</div></div>
              <div className="studioPipelineCard"><div className="small">ROI</div><div className="h">{totals.roi.toFixed(1)}%</div></div>
            </div>
            <div className="studioInlineSelect mt-4">
              <select className="input" value={metricJobId} onChange={(e) => setMetricJobId(e.target.value)}>
                <option value="">Select publish job</option>
                {jobs.map((job) => <option key={job.id} value={job.id}>{job.sourceTitle}</option>)}
              </select>
              <input className="input" value={views} onChange={(e) => setViews(e.target.value)} placeholder="Views" />
              <input className="input" value={clicks} onChange={(e) => setClicks(e.target.value)} placeholder="Clicks" />
              <input className="input" value={conversions} onChange={(e) => setConversions(e.target.value)} placeholder="Conversions" />
              <input className="input" value={revenue} onChange={(e) => setRevenue(e.target.value)} placeholder="Revenue" />
              <button className="tabBtn" onClick={() => { const job = jobs.find((x) => x.id === metricJobId); if (!job) return; addOutcome({ sourceId: job.id, sourceType: "publisher", title: job.sourceTitle, platform: job.targets[0]?.platform || "local", contentType: job.contentType, views: Number(views), clicks: Number(clicks), conversions: Number(conversions), revenue: Number(revenue) }); refresh(); }}>Add metric</button>
            </div>
            <div className="studioExportBlock mt-4"><pre>{JSON.stringify(outcomes.slice(0, 8), null, 2)}</pre></div>
          </CardFrame>
        </div>

        <div className="writersRight">
          <CardFrame title="Money Autopilot" subtitle="Best Next Move now chooses what to create from real outcome data." storageKey="publisher:autopilot" className="softCard">
            <div className="studioPipelineCard">
              <div className="cluster spread">
                <div>
                  <div className="small">Primary recommendation</div>
                  <div className="h">{autopilot.recommendation.title}</div>
                </div>
                <span className="badge good">{autopilot.recommendation.confidence}% confidence</span>
              </div>
              <div className="small mt-2">{autopilot.recommendation.body}</div>
              <div className="studioPillRow mt-4">
                <span className="studioPill">top platform: {autopilot.topPlatform}</span>
                <span className="studioPill">top type: {autopilot.topContentType}</span>
                <span className="studioPill">pending publish: {autopilot.pendingPublishCount}</span>
              </div>
            </div>
            <div className="studioInlineSelect mt-4">
              <select className="input" value={autopilotSettings.mode} onChange={(e) => { saveMoneyAutopilotSettings({ mode: e.target.value as any }); setAutopilotTick((x) => x + 1); }}>
                <option value="assist">Assist</option>
                <option value="full-auto">Full Auto</option>
              </select>
              <input className="input" value={String(autopilotSettings.minConfidence)} onChange={(e) => { saveMoneyAutopilotSettings({ minConfidence: Number(e.target.value || 0) }); setAutopilotTick((x) => x + 1); }} placeholder="Min confidence" />
              <button className="tabBtn" onClick={() => { const res = runMoneyAutopilotAction(); refresh(); window.alert(res.reason); }}>Run recommendation</button>
            </div>
            {!!autopilot.alternatives.length && <pre className="mt-4">{JSON.stringify(autopilot.alternatives, null, 2)}</pre>}
          </CardFrame>

          <CardFrame title="Product auto-listing" subtitle="Turn winners into Gumroad / Stripe / Etsy / local products." storageKey="publisher:commerce" className="softCard">
            <div className="row wrap">
              <button className="tabBtn" onClick={() => { autoDraftListingsFromWinners(); refresh(); }}>Draft listings</button>
              <button className="tabBtn" onClick={() => onNavigate("IncomeAutopilot")}>Open scheduler</button>
            </div>
            <div className="grid mt-4">
              {listings.length === 0 ? <div className="small">No product listings drafted yet.</div> : listings.slice(0, 4).map((item) => (
                <div key={item.id} className="studioPipelineCard">
                  <div className="cluster spread">
                    <div>
                      <div className="h">{item.title}</div>
                      <div className="small">{item.productType} • {item.platform}</div>
                    </div>
                    <button className="tabBtn" onClick={() => { publishCommerceListing(item.id); refresh(); }}>Publish</button>
                  </div>
                  <div className="studioPillRow mt-4">
                    <span className="studioPill">{item.status}</span>
                    <span className="studioPill">${item.price.toFixed(2)}</span>
                  </div>
                  {item.url ? <div className="small mt-2">{item.url}</div> : null}
                </div>
              ))}
            </div>
          </CardFrame>

          <CardFrame title="Outcome learning loop" subtitle="Turns results into the next best move." storageKey="publisher:learning" className="softCard">
            <div className="note">{learning.recommendation}</div>
            <div className="mt-4 small">Top platforms</div>
            <pre>{JSON.stringify(learning.topPlatforms, null, 2)}</pre>
            <div className="mt-4 small">Top content types</div>
            <pre>{JSON.stringify(learning.topTypes, null, 2)}</pre>
          </CardFrame>
        </div>
      </div>
    </div>
  );
}
