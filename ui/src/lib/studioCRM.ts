export type CRMStatus = "lead" | "active" | "waiting" | "delivered" | "repeat client";

export type FollowupPriority = "low" | "normal" | "high";

export type StudioLead = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status: CRMStatus;
  projectTitle?: string;
  notes?: string;
  nextFollowupAt?: string;
  priority: FollowupPriority;
  lastContactAt?: string;
  createdAt: string;
};

export type StudioClientRecord = {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  preferredContact?: string;
  tags?: string[];
  repeatClient: boolean;
  totalProjects: number;
  activeProjects: number;
  deliveredProjects: number;
  notes?: string;
  lastProjectAt?: string;
  nextFollowupAt?: string;
};

export type FollowupItem = {
  id: string;
  label: string;
  dueAt?: string;
  owner?: string;
  notes?: string;
  completed: boolean;
  linkedLeadId?: string;
  linkedClientId?: string;
};

export type CRMWorkspace = {
  leads: StudioLead[];
  clients: StudioClientRecord[];
  followups: FollowupItem[];
};

function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix = "crm") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function createLead(seed?: Partial<StudioLead>): StudioLead {
  return {
    id: seed?.id || uid("lead"),
    name: seed?.name || "New Lead",
    company: seed?.company || "",
    email: seed?.email || "",
    phone: seed?.phone || "",
    source: seed?.source || "",
    status: seed?.status || "lead",
    projectTitle: seed?.projectTitle || "",
    notes: seed?.notes || "",
    nextFollowupAt: seed?.nextFollowupAt || "",
    priority: seed?.priority || "normal",
    lastContactAt: seed?.lastContactAt || "",
    createdAt: seed?.createdAt || nowIso(),
  };
}

export function createClient(seed?: Partial<StudioClientRecord>): StudioClientRecord {
  return {
    id: seed?.id || uid("client"),
    name: seed?.name || "New Client",
    company: seed?.company || "",
    email: seed?.email || "",
    phone: seed?.phone || "",
    preferredContact: seed?.preferredContact || "email",
    tags: seed?.tags || [],
    repeatClient: !!seed?.repeatClient,
    totalProjects: seed?.totalProjects || 0,
    activeProjects: seed?.activeProjects || 0,
    deliveredProjects: seed?.deliveredProjects || 0,
    notes: seed?.notes || "",
    lastProjectAt: seed?.lastProjectAt || "",
    nextFollowupAt: seed?.nextFollowupAt || "",
  };
}

export function createFollowup(seed?: Partial<FollowupItem>): FollowupItem {
  return {
    id: seed?.id || uid("followup"),
    label: seed?.label || "Follow up",
    dueAt: seed?.dueAt || "",
    owner: seed?.owner || "",
    notes: seed?.notes || "",
    completed: !!seed?.completed,
    linkedLeadId: seed?.linkedLeadId || "",
    linkedClientId: seed?.linkedClientId || "",
  };
}

export function summarizeCRM(workspace: CRMWorkspace) {
  const leads = workspace.leads || [];
  const clients = workspace.clients || [];
  const followups = workspace.followups || [];
  const openFollowups = followups.filter((item) => !item.completed);
  const overdueFollowups = openFollowups.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < Date.now());
  const activeLeads = leads.filter((lead) => lead.status === "lead" || lead.status === "active");
  const repeatClients = clients.filter((client) => client.repeatClient);

  return {
    leadCount: leads.length,
    activeLeadCount: activeLeads.length,
    clientCount: clients.length,
    repeatClientCount: repeatClients.length,
    followupCount: followups.length,
    openFollowupCount: openFollowups.length,
    overdueFollowupCount: overdueFollowups.length,
    nextRecommendedAction: overdueFollowups.length
      ? "Clear overdue followups first."
      : activeLeads.length
      ? "Move the hottest lead into an active project."
      : clients.length
      ? "Check repeat-client opportunities."
      : "Create your first lead or client record.",
  };
}

export function leadsByStatus(leads: StudioLead[]) {
  return {
    lead: leads.filter((item) => item.status === "lead"),
    active: leads.filter((item) => item.status === "active"),
    waiting: leads.filter((item) => item.status === "waiting"),
    delivered: leads.filter((item) => item.status === "delivered"),
    repeatClient: leads.filter((item) => item.status === "repeat client"),
  };
}

export function followupsForLead(leadId: string, followups: FollowupItem[]) {
  return followups.filter((item) => item.linkedLeadId === leadId && !item.completed);
}

export function followupsForClient(clientId: string, followups: FollowupItem[]) {
  return followups.filter((item) => item.linkedClientId === clientId && !item.completed);
}

export function crmToMarkdown(workspace: CRMWorkspace) {
  const summary = summarizeCRM(workspace);
  const sections = [
    "# Studio CRM & Followups",
    "",
    `- Leads: ${summary.leadCount}`,
    `- Active leads: ${summary.activeLeadCount}`,
    `- Clients: ${summary.clientCount}`,
    `- Repeat clients: ${summary.repeatClientCount}`,
    `- Open followups: ${summary.openFollowupCount}`,
    `- Overdue followups: ${summary.overdueFollowupCount}`,
    "",
    "## Leads",
    ...workspace.leads.map((lead) => `- ${lead.name} — ${lead.status}${lead.projectTitle ? ` — ${lead.projectTitle}` : ""}`),
    "",
    "## Clients",
    ...workspace.clients.map((client) => `- ${client.name}${client.company ? ` (${client.company})` : ""} — ${client.repeatClient ? "repeat client" : "single-project"}`),
    "",
    "## Followups",
    ...workspace.followups.map((item) => `- ${item.label}${item.dueAt ? ` — due ${item.dueAt}` : ""}${item.completed ? " — completed" : ""}`),
  ];
  return sections.join("\n");
}
