export type ReviewStatus = "Not started" | "In review" | "Approved" | "Needs changes";

export type StudioRoomKey =
  | "home"
  | "writing"
  | "director"
  | "music"
  | "render"
  | "ops";

export type ClientProfile = {
  name: string;
  company?: string;
  contact?: string;
  brief?: string;
  audience?: string;
  releaseGoal?: string;
};

export type CollaboratorRole =
  | "Writer"
  | "Director"
  | "Composer"
  | "Editor"
  | "Producer"
  | "Reviewer"
  | "Client";

export type Collaborator = {
  id: string;
  name: string;
  role: CollaboratorRole;
  email?: string;
  notes?: string;
};

export type RoomReview = {
  room: StudioRoomKey;
  status: ReviewStatus;
  notes: string;
  updatedAt: number | null;
};

export type CollabState = {
  client: ClientProfile;
  collaborators: Collaborator[];
  roomReviews: Record<StudioRoomKey, RoomReview>;
  shareSummary: string;
};

export type PacketLike = {
  title?: string;
  projectType?: string;
  productionType?: string;
  releaseTarget?: string;
  summary?: { missingRooms?: StudioRoomKey[]; totalAssets?: number };
};

function uid() {
  return `collab_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createEmptyClientProfile(): ClientProfile {
  return {
    name: "",
    company: "",
    contact: "",
    brief: "",
    audience: "",
    releaseGoal: "",
  };
}

export function createDefaultRoomReviews(): Record<StudioRoomKey, RoomReview> {
  const now = null;
  return {
    home: { room: "home", status: "Not started", notes: "", updatedAt: now },
    writing: { room: "writing", status: "Not started", notes: "", updatedAt: now },
    director: { room: "director", status: "Not started", notes: "", updatedAt: now },
    music: { room: "music", status: "Not started", notes: "", updatedAt: now },
    render: { room: "render", status: "Not started", notes: "", updatedAt: now },
    ops: { room: "ops", status: "Not started", notes: "", updatedAt: now },
  };
}

export function createEmptyCollabState(): CollabState {
  return {
    client: createEmptyClientProfile(),
    collaborators: [],
    roomReviews: createDefaultRoomReviews(),
    shareSummary: "",
  };
}

export function createCollaborator(seed?: Partial<Collaborator>): Collaborator {
  return {
    id: seed?.id || uid(),
    name: seed?.name || "",
    role: seed?.role || "Reviewer",
    email: seed?.email || "",
    notes: seed?.notes || "",
  };
}

export function summarizeCollaborators(items: Collaborator[]): string {
  if (!items.length) return "No collaborators yet.";
  return items
    .map((person) => `${person.name || "Unnamed"} — ${person.role}${person.email ? ` (${person.email})` : ""}`)
    .join("\n");
}

export function updateRoomReview(
  roomReviews: Record<StudioRoomKey, RoomReview>,
  room: StudioRoomKey,
  patch: Partial<Omit<RoomReview, "room">>,
): Record<StudioRoomKey, RoomReview> {
  const current = roomReviews[room] || createDefaultRoomReviews()[room];
  return {
    ...roomReviews,
    [room]: {
      ...current,
      ...patch,
      room,
      updatedAt: Date.now(),
    },
  };
}

export function computeClientCollabReadiness(
  packet: PacketLike | null,
  state: CollabState,
): { score: number; blockers: string[]; nextAction: string } {
  const blockers: string[] = [];
  const missingRooms = packet?.summary?.missingRooms || [];

  if (!state.client.name.trim()) blockers.push("Add a client or project owner name.");
  if (!state.client.brief?.trim()) blockers.push("Add a client brief or internal product brief.");
  if (!state.collaborators.length) blockers.push("Add at least one collaborator or reviewer.");
  if (missingRooms.length) blockers.push(`Generate missing rooms: ${missingRooms.join(", ")}.`);
  const reviewStatuses = Object.values(state.roomReviews);
  const notApproved = reviewStatuses.filter((item) => item.status !== "Approved");
  if (notApproved.length) blockers.push("Approve each room or mark rooms that need changes.");

  const score = Math.max(0, 100 - blockers.length * 14);
  const nextAction =
    blockers[0] ||
    "Client/collab prep looks strong. Move into review handoff or publish prep.";

  return { score, blockers, nextAction };
}

export function buildShareMarkdown(packet: PacketLike | null, state: CollabState): string {
  const lines = [
    `# ${packet?.title || "Studio Project"}`,
    ``,
    `## Client / Owner`,
    `- Name: ${state.client.name || "—"}`,
    `- Company: ${state.client.company || "—"}`,
    `- Contact: ${state.client.contact || "—"}`,
    `- Release goal: ${state.client.releaseGoal || "—"}`,
    ``,
    `## Brief`,
    `${state.client.brief || "No brief yet."}`,
    ``,
    `## Collaborators`,
    summarizeCollaborators(state.collaborators),
    ``,
    `## Room Review Status`,
    ...(["home", "writing", "director", "music", "render", "ops"] as StudioRoomKey[]).map((room) => {
      const review = state.roomReviews[room];
      return `- ${room}: ${review?.status || "Not started"}${review?.notes ? ` — ${review.notes}` : ""}`;
    }),
    ``,
    `## Share Summary`,
    state.shareSummary || "No share summary yet.",
  ];
  return lines.join("\n");
}
