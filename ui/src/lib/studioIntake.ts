export type BriefApprovalState = "pending brief" | "approved brief" | "revision requested";

export type StudioIntake = {
  projectName: string;
  clientOwner: string;
  contact: string;
  goal: string;
  audience: string;
  deadline: string;
  budget: string;
  references: string;
};

export type CreativeBrief = {
  oneLineObjective: string;
  deliverables: string[];
  toneStyle: string;
  successCriteria: string[];
};

export type ScopeDefinition = {
  included: string[];
  excluded: string[];
  dependencies: string[];
  blockers: string[];
};

export type IntakeSnapshot = {
  intake: StudioIntake;
  brief: CreativeBrief;
  scope: ScopeDefinition;
  approvalState: BriefApprovalState;
  createdAt: number;
};

export const INTAKE_PRESETS = {
  blank: {
    intake: {
      projectName: "",
      clientOwner: "",
      contact: "",
      goal: "",
      audience: "",
      deadline: "",
      budget: "",
      references: "",
    },
    brief: {
      oneLineObjective: "",
      deliverables: [],
      toneStyle: "",
      successCriteria: [],
    },
    scope: {
      included: [],
      excluded: [],
      dependencies: [],
      blockers: [],
    },
    approvalState: "pending brief" as BriefApprovalState,
  },
};

function splitLines(value: string): string[] {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildCreativeBriefFromIntake(intake: StudioIntake): CreativeBrief {
  return {
    oneLineObjective:
      intake.goal ||
      `Create a launch-ready studio project for ${intake.clientOwner || intake.projectName || "this idea"}.`,
    deliverables: [
      intake.projectName ? `Primary project: ${intake.projectName}` : "Primary project deliverable",
      intake.audience ? `Audience-ready version for ${intake.audience}` : "Audience-targeted version",
      "Review-ready packet",
      "Render / output handoff",
    ],
    toneStyle: intake.references || "Aligned to the references and inspiration supplied in intake.",
    successCriteria: [
      "The brief is clear enough to generate the production pipeline.",
      "Deliverables are visible and easy to approve.",
      "The project can move into workflow stages without re-explaining the ask.",
    ],
  };
}

export function buildScopeDefinitionFromIntake(intake: StudioIntake): ScopeDefinition {
  return {
    included: [
      "Creative brief",
      "Structured production pipeline",
      "Render handoff and output prep",
      intake.deadline ? `Delivery target aligned to ${intake.deadline}` : "Delivery target alignment",
    ],
    excluded: [
      "Anything not explicitly requested in the brief",
      "Scope additions without review",
    ],
    dependencies: [
      intake.references ? "Reference materials / inspiration links" : "Reference materials",
      intake.contact ? `Client / owner feedback via ${intake.contact}` : "Client / owner feedback",
    ],
    blockers: [],
  };
}

export function createIntakeSnapshot(
  intake: StudioIntake,
  brief?: Partial<CreativeBrief>,
  scope?: Partial<ScopeDefinition>,
  approvalState: BriefApprovalState = "pending brief",
): IntakeSnapshot {
  return {
    intake,
    brief: {
      ...buildCreativeBriefFromIntake(intake),
      ...(brief || {}),
      deliverables: brief?.deliverables || buildCreativeBriefFromIntake(intake).deliverables,
      successCriteria: brief?.successCriteria || buildCreativeBriefFromIntake(intake).successCriteria,
    },
    scope: {
      ...buildScopeDefinitionFromIntake(intake),
      ...(scope || {}),
      included: scope?.included || buildScopeDefinitionFromIntake(intake).included,
      excluded: scope?.excluded || buildScopeDefinitionFromIntake(intake).excluded,
      dependencies: scope?.dependencies || buildScopeDefinitionFromIntake(intake).dependencies,
      blockers: scope?.blockers || buildScopeDefinitionFromIntake(intake).blockers,
    },
    approvalState,
    createdAt: Date.now(),
  };
}

export function intakeSnapshotToMarkdown(snapshot: IntakeSnapshot): string {
  const { intake, brief, scope, approvalState, createdAt } = snapshot;
  const bullet = (items: string[]) => items.map((i) => `- ${i}`).join("\n") || "- none";

  return [
    `# ${intake.projectName || "Untitled Studio Intake"}`,
    ``,
    `## Intake`,
    `- Client / owner: ${intake.clientOwner || "—"}`,
    `- Contact: ${intake.contact || "—"}`,
    `- Goal: ${intake.goal || "—"}`,
    `- Audience: ${intake.audience || "—"}`,
    `- Deadline: ${intake.deadline || "—"}`,
    `- Budget: ${intake.budget || "—"}`,
    `- References: ${intake.references || "—"}`,
    ``,
    `## Creative Brief`,
    `- One-line objective: ${brief.oneLineObjective || "—"}`,
    `- Tone / style: ${brief.toneStyle || "—"}`,
    `### Deliverables`,
    bullet(brief.deliverables || []),
    `### Success Criteria`,
    bullet(brief.successCriteria || []),
    ``,
    `## Scope`,
    `### Included`,
    bullet(scope.included || []),
    `### Not Included`,
    bullet(scope.excluded || []),
    `### Dependencies`,
    bullet(scope.dependencies || []),
    `### Blockers`,
    bullet(scope.blockers || []),
    ``,
    `## Approval`,
    `- Status: ${approvalState}`,
    `- Snapshot time: ${new Date(createdAt).toLocaleString()}`,
  ].join("\n");
}

export function toLineItems(value: string): string[] {
  return splitLines(value);
}