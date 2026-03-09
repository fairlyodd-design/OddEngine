import React, { useEffect, useMemo, useState } from 'react';
import PanelChrome from '../components/PanelChrome';
import MarketGraph from './MarketGraph';
import { MOCK_EXPIRATIONS, type MockContract } from '../lib/optionsChainMocks';
import { PHOENIX_WATCHLIST, sniperSummary } from '../lib/marketDataPhoenix';
import { buildSniperWorkflow } from '../lib/sniperWorkflow';
import {
  createPublicAccessToken,
  DEFAULT_BROKER_SETTINGS,
  loadBrokerChain,
  loadBrokerExpirations,
  readBrokerAdapterSettings,
  saveBrokerAdapterSettings,
  type BrokerAdapterSettings,
} from '../lib/brokerAdapter';

type GreekFocus = 'score' | 'delta' | 'gamma' | 'theta' | 'vega' | 'probability';
type SideFilter = 'all' | 'call' | 'put';
type TicketTemplate = {
  id: string;
  name: string;
  stopPct: number;
  tp1Pct: number;
  tp2Pct: number;
  contracts: number;
};

const TEMPLATE_KEY = 'oddengine:sniper:ticketTemplates:v1';
const DEFAULT_TEMPLATES: TicketTemplate[] = [
  { id: 'scalp-a', name: 'Scalp A', stopPct: 24, tp1Pct: 25, tp2Pct: 50, contracts: 1 },
  { id: 'trend-rider', name: 'Trend Rider', stopPct: 30, tp1Pct: 35, tp2Pct: 80, contracts: 1 },
  { id: 'lotto-light', name: 'Lotto Light', stopPct: 45, tp1Pct: 60, tp2Pct: 120, contracts: 1 },
];

function fmt(n: number, digits = 2) {
  return Number(n).toFixed(digits);
}

function sortContracts(contracts: MockContract[], focus: GreekFocus) {
  const items = [...contracts];
  switch (focus) {
    case 'delta':
      return items.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    case 'gamma':
      return items.sort((a, b) => b.gamma - a.gamma);
    case 'theta':
      return items.sort((a, b) => Math.abs(a.theta) - Math.abs(b.theta));
    case 'vega':
      return items.sort((a, b) => b.vega - a.vega);
    case 'probability':
      return items.sort((a, b) => b.probability - a.probability);
    default:
      return items.sort((a, b) => b.score - a.score);
  }
}

function readTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as TicketTemplate[]) : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export default function OptionsSniperTerminal() {
  const summary = sniperSummary();
  const [symbol, setSymbol] = useState(PHOENIX_WATCHLIST[0]?.symbol || 'SPY');
  const currentWatch = useMemo(() => PHOENIX_WATCHLIST.find((item) => item.symbol === symbol) || PHOENIX_WATCHLIST[0], [symbol]);
  const [settings, setSettings] = useState<BrokerAdapterSettings>(DEFAULT_BROKER_SETTINGS);
  const [expirations, setExpirations] = useState<string[]>(MOCK_EXPIRATIONS);
  const [expiration, setExpiration] = useState(MOCK_EXPIRATIONS[0]);
  const [side, setSide] = useState<SideFilter>('all');
  const [focus, setFocus] = useState<GreekFocus>('score');
  const [chainRaw, setChainRaw] = useState<MockContract[]>([]);
  const [sourceLabel, setSourceLabel] = useState('Phoenix mock chain');
  const [feedUpdated, setFeedUpdated] = useState<string | null>(null);
  const [adapterStatus, setAdapterStatus] = useState('Loading broker adapter…');
  const [adapterError, setAdapterError] = useState('');
  const [usedFallback, setUsedFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAdapter, setShowAdapter] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);

  useEffect(() => {
    const stored = readBrokerAdapterSettings();
    setSettings(stored);
  }, []);

  function patchSettings(patch: Partial<BrokerAdapterSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveBrokerAdapterSettings(next);
      return next;
    });
  }

  async function refreshExpirations(nextSymbol = symbol, nextSettings = settings) {
    const result = await loadBrokerExpirations({ symbol: nextSymbol, settings: nextSettings });
    if (result.expirations.length) {
      setExpirations(result.expirations);
      setExpiration((prev) => (result.expirations.includes(prev) ? prev : result.expirations[0]));
    } else {
      setExpirations(MOCK_EXPIRATIONS);
      setExpiration((prev) => (MOCK_EXPIRATIONS.includes(prev) ? prev : MOCK_EXPIRATIONS[0]));
    }
    if (result.status) setAdapterStatus(result.status);
  }

  async function refreshChain(nextExpiration?: string, nextSettings?: BrokerAdapterSettings) {
    const activeSettings = nextSettings || settings;
    const targetExpiration = nextExpiration || expiration;
    setBusy(true);
    setAdapterError('');
    const result = await loadBrokerChain({
      symbol: currentWatch.symbol,
      underlying: currentWatch.price,
      expiration: targetExpiration,
      bias: currentWatch.bias,
      settings: activeSettings,
    });
    setChainRaw(result.contracts);
    setSourceLabel(result.sourceLabel);
    setFeedUpdated(result.feedUpdated);
    setAdapterStatus(result.status);
    setUsedFallback(result.usedFallback);
    setAdapterError(result.error || '');
    if (result.expirations.length) {
      setExpirations(result.expirations);
      if (result.expirations.includes(targetExpiration)) setExpiration(targetExpiration);
      else setExpiration(result.expirations[0]);
    }
    setBusy(false);
  }

  useEffect(() => {
    if (!currentWatch) return;
    void refreshExpirations(currentWatch.symbol, settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWatch.symbol, settings.mode]);

  useEffect(() => {
    if (!currentWatch) return;
    void refreshChain(expiration, settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWatch.symbol, expiration, settings.mode]);

  const filtered = useMemo(() => (side === 'all' ? chainRaw : chainRaw.filter((c) => c.side === side)), [chainRaw, side]);
  const contracts = useMemo(() => sortContracts(filtered, focus), [filtered, focus]);
  const [selectedId, setSelectedId] = useState(contracts[0]?.id || '');
  useEffect(() => {
    setSelectedId((prev) => (contracts.some((c) => c.id === prev) ? prev : contracts[0]?.id || ''));
  }, [contracts]);
  const selected = contracts.find((c) => c.id === selectedId) || contracts[0];

  const [templates, setTemplates] = useState<TicketTemplate[]>(DEFAULT_TEMPLATES);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [templateName, setTemplateName] = useState('');
  useEffect(() => {
    setTemplates(readTemplates());
  }, []);
  useEffect(() => {
    if (!templates.some((t) => t.id === templateId) && templates[0]) setTemplateId(templates[0].id);
  }, [templates, templateId]);

  const activeTemplate = templates.find((t) => t.id === templateId) || templates[0] || DEFAULT_TEMPLATES[0];
  const entry = selected?.ask || 0;
  const stop = +(entry * (1 - activeTemplate.stopPct / 100)).toFixed(2);
  const tp1 = +(entry * (1 + activeTemplate.tp1Pct / 100)).toFixed(2);
  const tp2 = +(entry * (1 + activeTemplate.tp2Pct / 100)).toFixed(2);
  const riskPerContract = Math.max(0, entry - stop) * 100;
  const rewardPerContract1 = Math.max(0, tp1 - entry) * 100;
  const rewardPerContract2 = Math.max(0, tp2 - entry) * 100;
  const workflow = buildSniperWorkflow({
    symbol: currentWatch.symbol,
    expiration,
    contractLabel: selected ? `${selected.symbol} ${selected.strike}${selected.side === 'call' ? 'C' : 'P'}` : 'No contract',
    score: selected?.score || 0,
    templateName: activeTemplate?.name,
  });

  function saveTemplate() {
    const name = templateName.trim();
    if (!name || !activeTemplate) return;
    const newTemplate: TicketTemplate = {
      ...activeTemplate,
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      name,
    };
    const next = [newTemplate, ...templates].slice(0, 8);
    setTemplates(next);
    setTemplateId(newTemplate.id);
    setTemplateName('');
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next));
  }

  async function handleCreateToken() {
    if (!settings.publicSecretKey.trim()) {
      setAdapterError('Paste a Public secret key first.');
      return;
    }
    setCreatingToken(true);
    setAdapterError('');
    try {
      const token = await createPublicAccessToken(settings.publicSecretKey.trim());
      patchSettings({ publicAccessToken: token, mode: 'public-api' });
      setAdapterStatus('Public access token created. Add/select accountId next.');
    } catch (e: any) {
      setAdapterError(String(e?.message || e || 'Token creation failed'));
    } finally {
      setCreatingToken(false);
    }
  }

  const adapterBadgeClass = settings.mode === 'public-api' && !usedFallback ? 'badge good' : settings.mode === 'custom' && !usedFallback ? 'badge good' : usedFallback ? 'badge warn' : 'badge';
  const selectedLabel = selected ? `${selected.symbol} ${selected.strike}${selected.side === 'call' ? 'C' : 'P'}` : 'No contract';
  const postureLabel = currentWatch.bias === 'bullish' ? 'Long bias active' : currentWatch.bias === 'bearish' ? 'Short bias active' : 'Neutral / wait for edge';

  return (
    <div className="stack loose">
      <PanelChrome title="Options Sniper Terminal" subtitle="Broker-style live data adapter + greeks + saved ticket templates" right={<span className={adapterBadgeClass}>{usedFallback ? 'Fallback active' : sourceLabel}</span>} />

      <div className="card softCard sniperShellCard">
        <div className="small shellEyebrow">TRADING WORKSTATION</div>
        <div className="h" style={{ marginTop: 6 }}>📊 Options Sniper Terminal</div>
        <div className="sub" style={{ marginTop: 8 }}>{summary.headline}</div>
        <div className="sniperHeroGrid">
          <div className="sniperHeroMetric">
            <div className="sniperHeroLabel">Selected lane</div>
            <div className="sniperHeroValue">{currentWatch.symbol}</div>
            <div className="sniperHeroSub">{currentWatch.setup}</div>
          </div>
          <div className="sniperHeroMetric">
            <div className="sniperHeroLabel">Best contract</div>
            <div className="sniperHeroValue sniperHeroValueSm">{selectedLabel}</div>
            <div className="sniperHeroSub">Score {selected?.score || 0} · {selected?.probability || 0}% probability</div>
          </div>
          <div className="sniperHeroMetric">
            <div className="sniperHeroLabel">Execution posture</div>
            <div className="sniperHeroValue sniperHeroValueSm">{postureLabel}</div>
            <div className="sniperHeroSub">{currentWatch.catalyst} · {currentWatch.confidence}% confidence</div>
          </div>
          <div className="sniperHeroMetric">
            <div className="sniperHeroLabel">Ticket model</div>
            <div className="sniperHeroValue sniperHeroValueSm">{activeTemplate.name}</div>
            <div className="sniperHeroSub">Stop {activeTemplate.stopPct}% · TP {activeTemplate.tp1Pct}/{activeTemplate.tp2Pct}%</div>
          </div>
        </div>
      </div>

      <MarketGraph embedded />

      <div className="card">
        <div className="widgetHeader">
          <div className="widgetHeaderLeft">
            <div className="widgetTitle">Broker-style live data adapter</div>
            <div className="widgetSubtitle">Swap between safe Phoenix mocks, Public API mode, or a local broker proxy without rewriting the panel</div>
          </div>
          <div className="widgetHeaderRight">
            <span className={adapterBadgeClass}>{settings.mode}</span>
            <button onClick={() => setShowAdapter((v) => !v)}>{showAdapter ? 'Hide adapter' : 'Show adapter'}</button>
            <button onClick={() => void refreshChain()} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh chain'}</button>
          </div>
        </div>
        <div className="widgetBody" style={{ display: 'grid', gap: 10 }}>
          <div className="subCard">
            <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div>
                <div className="widgetTitle">{sourceLabel}</div>
                <div className="widgetSubtitle">{adapterStatus}{feedUpdated ? ` • updated ${feedUpdated}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="small">Provider lane</div>
                <div className="badge">{usedFallback ? 'mock fallback' : settings.mode}</div>
              </div>
            </div>
            {!!adapterError && <div className="small" style={{ marginTop: 8, color: 'var(--danger, #ff8c8c)' }}>{adapterError}</div>}
          </div>

          {showAdapter && (
            <div className="subCard" style={{ display: 'grid', gap: 10 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className={settings.mode === 'mock' ? 'tabBtn active' : 'tabBtn'} onClick={() => patchSettings({ mode: 'mock' })}>Mock</button>
                <button className={settings.mode === 'public-api' ? 'tabBtn active' : 'tabBtn'} onClick={() => patchSettings({ mode: 'public-api' })}>Public API</button>
                <button className={settings.mode === 'custom' ? 'tabBtn active' : 'tabBtn'} onClick={() => patchSettings({ mode: 'custom' })}>Custom proxy</button>
              </div>

              {settings.mode === 'public-api' && (
                <>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <input type="password" value={settings.publicSecretKey} onChange={(e) => patchSettings({ publicSecretKey: e.target.value })} placeholder="Public secret key" style={{ flex: 1, minWidth: 220 }} />
                    <button onClick={() => void handleCreateToken()} disabled={creatingToken}>{creatingToken ? 'Creating…' : 'Create token'}</button>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <input type="password" value={settings.publicAccessToken} onChange={(e) => patchSettings({ publicAccessToken: e.target.value })} placeholder="Bearer token" style={{ flex: 1, minWidth: 220 }} />
                    <input value={settings.publicAccountId} onChange={(e) => patchSettings({ publicAccountId: e.target.value })} placeholder="accountId" style={{ width: 180 }} />
                    <button onClick={() => void refreshExpirations(symbol, settings)}>Load expirations</button>
                  </div>
                  <div className="small">Broker-style flow: create/paste token, add accountId, load expirations, then refresh the live chain. If the request fails, Phoenix mock fallback keeps the workstation alive.</div>
                </>
              )}

              {settings.mode === 'custom' && (
                <>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <input value={settings.customBaseUrl} onChange={(e) => patchSettings({ customBaseUrl: e.target.value })} placeholder="http://127.0.0.1:8787" style={{ flex: 1, minWidth: 260 }} />
                    <button onClick={() => void refreshExpirations(symbol, settings)}>Probe adapter</button>
                  </div>
                  <div className="small">Expected endpoints: <code>/expirations?symbol=SPY</code> and <code>/chain?symbol=SPY&amp;expiration=2026-03-13</code>. Return a JSON contract list shaped like the sniper chain rows.</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="widgetHeader">
          <div className="widgetHeaderLeft">
            <div className="widgetTitle">Phoenix watch lane</div>
            <div className="widgetSubtitle">Pick the leader, then rank the chain by the greek you care about</div>
          </div>
          <div className="widgetHeaderRight">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ width: 130 }}>
              {PHOENIX_WATCHLIST.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}
            </select>
            <span className={`badge ${currentWatch.priority === 'A' ? 'good' : ''}`}>{currentWatch.priority}-grade</span>
          </div>
        </div>
        <div className="widgetBody" style={{ display: 'grid', gap: 10 }}>
          <div className="subCard">
            <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div className="widgetTitle">{currentWatch.symbol} · {currentWatch.name}</div>
                <div className="widgetSubtitle">{currentWatch.setup} · {currentWatch.catalyst}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="badge">{currentWatch.confidence}%</div>
                <div className="small" style={{ marginTop: 4 }}>{currentWatch.lane} lane</div>
              </div>
            </div>
          </div>
          <div className="sniperWatchGrid">
            {PHOENIX_WATCHLIST.map((item) => (
              <div key={item.symbol} className={`sniperWatchTile ${item.symbol === symbol ? 'active' : ''}`} onClick={() => setSymbol(item.symbol)}>
                <div className="sniperWatchTileTop">
                  <b>{item.symbol}</b>
                  <span className="badge">{item.confidence}%</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{item.setup}</div>
                <div className="small" style={{ marginTop: 6, opacity: 0.8 }}>${item.price.toFixed(2)} • {item.changePct > 0 ? '+' : ''}{item.changePct.toFixed(2)}% • {item.bias}</div>
                <div className="small" style={{ marginTop: 6, opacity: 0.72 }}>{item.priority}-grade • IV {item.ivRank}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="widgetHeader">
          <div className="widgetHeaderLeft">
            <div className="widgetTitle">Sniper workflow</div>
            <div className="widgetSubtitle">Broker-style handoff from watch lane to contract selection</div>
          </div>
          <div className="widgetHeaderRight">
            <select value={expiration} onChange={(e) => setExpiration(e.target.value)} style={{ width: 140 }}>
              {expirations.map((exp) => <option key={exp}>{exp}</option>)}
            </select>
            <select value={side} onChange={(e) => setSide(e.target.value as SideFilter)} style={{ width: 110 }}>
              <option value="all">All</option>
              <option value="call">Calls</option>
              <option value="put">Puts</option>
            </select>
            <select value={focus} onChange={(e) => setFocus(e.target.value as GreekFocus)} style={{ width: 128 }}>
              <option value="score">Best score</option>
              <option value="delta">Delta</option>
              <option value="gamma">Gamma</option>
              <option value="theta">Theta</option>
              <option value="vega">Vega</option>
              <option value="probability">Probability</option>
            </select>
          </div>
        </div>
        <div className="widgetBody workflowSteps">
          {workflow.map((step) => (
            <div key={step.id} className={`workflowStep ${step.status}`}>
              <div className="stepStatus">{step.status}</div>
              <div>
                <div className="widgetTitle">{step.label}</div>
                <div className="widgetSubtitle">{step.detail}</div>
              </div>
              <div className="small">{step.since}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sniperDeskGrid">
        <div className="card">
          <div className="widgetHeader">
            <div className="widgetHeaderLeft">
              <div className="widgetTitle">Options chain</div>
              <div className="widgetSubtitle">{symbol} · {expiration} · ranked by {focus}</div>
            </div>
            <div className="widgetHeaderRight">
              <span className={adapterBadgeClass}>{usedFallback ? 'Fallback' : settings.mode}</span>
              <span className="badge good">{contracts[0]?.score || 0} top score</span>
            </div>
          </div>
          <div className="widgetBody" style={{ gap: 12 }}>
            <div className="sniperSelectionBanner">
              <div>
                <div className="small shellEyebrow">SELECTED CONTRACT</div>
                <div className="widgetTitle" style={{ marginTop: 6 }}>{selectedLabel}</div>
                <div className="widgetSubtitle" style={{ marginTop: 6 }}>Ask ${fmt(entry)} · {selected?.probability || 0}% probability · spread {selected ? fmt(selected.spreadPct, 1) : '0.0'}%</div>
              </div>
              <div className="sniperSelectionStats">
                <div className="kv"><div className="kvLabel">Δ</div><div className="kvValue">{selected ? fmt(selected.delta) : '0.00'}</div></div>
                <div className="kv"><div className="kvLabel">Γ</div><div className="kvValue">{selected ? fmt(selected.gamma, 3) : '0.000'}</div></div>
                <div className="kv"><div className="kvLabel">Θ</div><div className="kvValue">{selected ? fmt(selected.theta, 3) : '0.000'}</div></div>
                <div className="kv"><div className="kvLabel">V</div><div className="kvValue">{selected ? fmt(selected.vega, 3) : '0.000'}</div></div>
              </div>
            </div>
            <div className="tableWrap">
              <table className="chainTable sniperChainTable">
                <thead>
                  <tr><th>Strike</th><th>Side</th><th>Bid</th><th>Ask</th><th>Score</th><th>Prob</th><th>OI</th><th>Δ</th><th>Γ</th><th>Θ</th><th>V</th><th>Spread</th></tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className={c.id === selected?.id ? 'chainRowActive' : ''} onClick={() => setSelectedId(c.id)} style={{ cursor: 'pointer' }}>
                      <td>{c.strike}</td>
                      <td>{c.side.toUpperCase()}</td>
                      <td>{fmt(c.bid)}</td>
                      <td>{fmt(c.ask)}</td>
                      <td>{c.score}</td>
                      <td>{c.probability}%</td>
                      <td>{c.oi}</td>
                      <td>{fmt(c.delta)}</td>
                      <td>{fmt(c.gamma, 3)}</td>
                      <td>{fmt(c.theta, 3)}</td>
                      <td>{fmt(c.vega, 3)}</td>
                      <td>{fmt(c.spreadPct, 1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="contractDrawer sniperDetailDrawer">
            <div className="widgetTitle">Contract detail drawer</div>
            <div className="widgetSubtitle">{selectedLabel}</div>
            {selected && (
              <>
                <div className="kvGrid mt-5">
                  {[
                    ['Last', `$${fmt(selected.last)}`],
                    ['Volume', String(selected.volume)],
                    ['Open interest', String(selected.oi)],
                    ['Probability', `${selected.probability}%`],
                    ['Spread', `${fmt(selected.spreadPct, 1)}%`],
                    ['Score', String(selected.score)],
                    ['Gamma', fmt(selected.gamma, 3)],
                    ['Theta', fmt(selected.theta, 3)],
                    ['Vega', fmt(selected.vega, 3)],
                  ].map(([label, value]) => (
                    <div key={label} className="kv"><div className="kvLabel">{label}</div><div className="kvValue">{value}</div></div>
                  ))}
                </div>
                <div className="subCard mt-5">
                  <div className="small shellEyebrow">READOUT</div>
                  <div className="small" style={{ marginTop: 8, lineHeight: 1.45 }}>
                    {selected.side === 'call' ? 'Calls fit best when continuation holds above the current lane trigger.' : 'Puts fit best when the lane fails and momentum breaks lower.'} Favor tighter spreads and real open interest before sizing.
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="widgetHeader">
              <div className="widgetHeaderLeft">
                <div className="widgetTitle">Trade ticket builder</div>
                <div className="widgetSubtitle">Saved templates keep your small-account rules consistent</div>
              </div>
              <div className="widgetHeaderRight">
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ width: 150 }}>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </div>
            </div>
            <div className="widgetBody" style={{ gap: 12 }}>
              <div className="sniperTicketMetrics">
                <div className="kv"><div className="kvLabel">Entry</div><div className="kvValue">${fmt(entry)}</div></div>
                <div className="kv"><div className="kvLabel">Stop</div><div className="kvValue">${fmt(stop)}</div></div>
                <div className="kv"><div className="kvLabel">TP 1</div><div className="kvValue">${fmt(tp1)}</div></div>
                <div className="kv"><div className="kvLabel">TP 2</div><div className="kvValue">${fmt(tp2)}</div></div>
                <div className="kv"><div className="kvLabel">Contracts</div><div className="kvValue">{activeTemplate.contracts}</div></div>
                <div className="kv"><div className="kvLabel">Risk</div><div className="kvValue">${fmt(riskPerContract, 0)}/ctr</div></div>
              </div>
              <div className="sniperTicketMetrics compact">
                <div className="kv"><div className="kvLabel">R:R to TP1</div><div className="kvValue">{riskPerContract > 0 ? `${fmt(rewardPerContract1 / riskPerContract, 1)}R` : '—'}</div></div>
                <div className="kv"><div className="kvLabel">R:R to TP2</div><div className="kvValue">{riskPerContract > 0 ? `${fmt(rewardPerContract2 / riskPerContract, 1)}R` : '—'}</div></div>
                <div className="kv"><div className="kvLabel">Ticket source</div><div className="kvValue">{usedFallback ? 'Phoenix' : settings.mode}</div></div>
              </div>
              <div className="subCard">
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <div className="small">Save current rules as template</div>
                  <div className="small">Stop {activeTemplate.stopPct}% · TP {activeTemplate.tp1Pct}/{activeTemplate.tp2Pct}%</div>
                </div>
                <div className="row mt-5" style={{ gap: 8 }}>
                  <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Name this setup" style={{ flex: 1 }} />
                  <button onClick={saveTemplate}>Save template</button>
                </div>
              </div>
              <div className="subCard">
                <div className="small">Broker-friendly block</div>
                <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--fg)' }}>{selected ? `BUY ${activeTemplate.contracts} ${selected.symbol} ${selected.strike}${selected.side === 'call' ? 'C' : 'P'} ${expiration}\nENTRY ${fmt(entry)} LIMIT\nSTOP ${fmt(stop)}\nTP1 ${fmt(tp1)}\nTP2 ${fmt(tp2)}\nRISK $${fmt(riskPerContract * activeTemplate.contracts, 0)} TOTAL\nTEMPLATE ${activeTemplate.name}\nSOURCE ${sourceLabel}` : 'Select a contract to build a ticket.'}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
