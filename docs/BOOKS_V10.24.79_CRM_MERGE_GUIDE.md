# Books.tsx merge guide for v10.24.79 Studio CRM And Followups

This pass keeps the stable `Books` route/component seam and layers CRM onto the current Studio panel.

## 1) Add imports

```ts
import {
  createClient,
  createFollowup,
  createLead,
  crmToMarkdown,
  summarizeCRM,
  type CRMWorkspace,
  type FollowupItem,
  type StudioClientRecord,
  type StudioLead,
} from "../lib/studioCRM";
```

## 2) Add a local storage key

```ts
const KEY_STUDIO_CRM = "oddengine:writers:studioCRM:v1";
```

## 3) Add state near the other Studio state

```ts
const [crmWorkspace, setCrmWorkspace] = useState<CRMWorkspace>(() =>
  loadJSON<CRMWorkspace>(KEY_STUDIO_CRM, {
    leads: [],
    clients: [],
    followups: [],
  })
);
```

Persist it:

```ts
useEffect(() => {
  saveJSON(KEY_STUDIO_CRM, crmWorkspace);
}, [crmWorkspace]);
```

## 4) Add helpers

```ts
const crmSummary = useMemo(() => summarizeCRM(crmWorkspace), [crmWorkspace]);

const addLead = () => {
  const lead = createLead({
    projectTitle: activeProject?.title || "",
  });
  setCrmWorkspace((prev) => ({ ...prev, leads: [lead, ...prev.leads] }));
};

const addClient = () => {
  const client = createClient();
  setCrmWorkspace((prev) => ({ ...prev, clients: [client, ...prev.clients] }));
};

const addFollowup = () => {
  const linkedLeadId = crmWorkspace.leads[0]?.id || "";
  const followup = createFollowup({
    linkedLeadId,
    label: activeProject?.title ? `Follow up on ${activeProject.title}` : "Follow up",
  });
  setCrmWorkspace((prev) => ({ ...prev, followups: [followup, ...prev.followups] }));
};

const copyCRMMarkdown = async () => {
  await navigator.clipboard.writeText(crmToMarkdown(crmWorkspace));
};
```

## 5) Add a CRM section inside Studio / Books

Place this under your review / publish area or project desk area:

```tsx
<div className="card softCard mt-4">
  <div className="small shellEyebrow">STUDIO CRM & FOLLOWUPS</div>
  <div className="sub mt-2">
    Track leads, clients, followups, and repeat-client flow directly inside the Studio workspace.
  </div>

  <div className="row wrap mt-3" style={{ gap: 10 }}>
    <button className="tabBtn active" onClick={addLead}>New Lead</button>
    <button className="tabBtn" onClick={addClient}>New Client</button>
    <button className="tabBtn" onClick={addFollowup}>New Followup</button>
    <button className="tabBtn" onClick={() => void copyCRMMarkdown()}>Copy CRM Markdown</button>
  </div>

  <div className="mt-4" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
    <div className="card softCard">
      <div className="small shellEyebrow">SUMMARY</div>
      <div className="small mt-2"><b>Leads:</b> {crmSummary.leadCount}</div>
      <div className="small mt-1"><b>Clients:</b> {crmSummary.clientCount}</div>
      <div className="small mt-1"><b>Open followups:</b> {crmSummary.openFollowupCount}</div>
      <div className="small mt-1"><b>Overdue:</b> {crmSummary.overdueFollowupCount}</div>
      <div className="small mt-3">{crmSummary.nextRecommendedAction}</div>
    </div>

    <div className="card softCard">
      <div className="small shellEyebrow">LEADS</div>
      {!crmWorkspace.leads.length ? <div className="small mt-3">No leads yet.</div> : crmWorkspace.leads.slice(0, 5).map((lead) => (
        <div key={lead.id} className="small mt-2"><b>{lead.name}</b> — {lead.status}</div>
      ))}
    </div>

    <div className="card softCard">
      <div className="small shellEyebrow">CLIENTS</div>
      {!crmWorkspace.clients.length ? <div className="small mt-3">No clients yet.</div> : crmWorkspace.clients.slice(0, 5).map((client) => (
        <div key={client.id} className="small mt-2"><b>{client.name}</b>{client.repeatClient ? " — repeat client" : ""}</div>
      ))}
    </div>

    <div className="card softCard">
      <div className="small shellEyebrow">FOLLOWUPS</div>
      {!crmWorkspace.followups.length ? <div className="small mt-3">No followups yet.</div> : crmWorkspace.followups.slice(0, 5).map((item) => (
        <div key={item.id} className="small mt-2"><b>{item.label}</b>{item.dueAt ? ` — due ${item.dueAt}` : ""}</div>
      ))}
    </div>
  </div>
</div>
```
