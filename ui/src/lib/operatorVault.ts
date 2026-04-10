import { oddApi } from "./odd";

export type VaultCustomEntry = {
  id: string;
  label: string;
  username: string;
  password: string;
  apiKey: string;
  apiSecret: string;
  notes: string;
};

export type EntertainmentVaultEntry = {
  id: string;
  serviceId: string;
  label: string;
  username: string;
  password: string;
  profile: string;
  pin: string;
  apiKey: string;
  apiSecret: string;
  notes: string;
};

export type CameraVaultEntry = {
  id: string;
  label: string;
  location: string;
  url: string;
  username: string;
  password: string;
  pin: string;
  apiKey: string;
  apiSecret: string;
  notes: string;
};

export type OperatorProfile = {
  displayName: string;
  preferredName: string;
  city: string;
  timeZone: string;
  businessEmail: string;
};

export type OperatorVault = {
  profile: OperatorProfile;
  trading: {
    broker: string;
    username: string;
    password: string;
    apiKey: string;
    apiSecret: string;
    accountId: string;
    defaultSymbol: string;
    watchlist: string;
    scannerUrl: string;
    notes: string;
  };
  content: {
    kdpEmail: string;
    gumroadEmail: string;
    gumroadApiKey: string;
    openaiApiKey: string;
    affiliateTag: string;
    notes: string;
  };
  mining: {
    walletAddress: string;
    walletLabel: string;
    poolName: string;
    poolApiKey: string;
    workerName: string;
    dashboardUrl: string;
    username: string;
    password: string;
    powerCostKwh: string;
    notes: string;
  };
  games: {
    zbdHandle: string;
    zbdApiKey: string;
    prolificEmail: string;
    surveyEmail: string;
    notes: string;
  };
  entertainment: {
    householdLabel: string;
    familyProfile: string;
    kidsProfile: string;
    defaultServiceId: string;
    deviceNotes: string;
    notes: string;
    accounts: EntertainmentVaultEntry[];
  };
  grow: {
    roomLabel: string;
    haUrl: string;
    haToken: string;
    deviceSlug: string;
    tempEntity: string;
    rhEntity: string;
    notes: string;
  };
  cameras: {
    wallLabel: string;
    frigateUrl: string;
    frigateApiKey: string;
    defaultGrid: string;
    nvrHost: string;
    nvrUser: string;
    nvrPass: string;
    notes: string;
    accounts: CameraVaultEntry[];
  };
  custom: VaultCustomEntry[];
  updatedAt: number;
};

export type OperatorVaultStatus = {
  ok: boolean;
  mode: "safeStorage" | "plain-json" | "localStorage";
  encrypted: boolean;
  desktop: boolean;
  path?: string;
  error?: string;
};

const KEY = "oddengine:operator-vault:v1";

export const DEFAULT_OPERATOR_VAULT: OperatorVault = {
  profile: {
    displayName: "",
    preferredName: "",
    city: "",
    timeZone: "",
    businessEmail: "",
  },
  trading: {
    broker: "",
    username: "",
    password: "",
    apiKey: "",
    apiSecret: "",
    accountId: "",
    defaultSymbol: "",
    watchlist: "",
    scannerUrl: "",
    notes: "",
  },
  content: {
    kdpEmail: "",
    gumroadEmail: "",
    gumroadApiKey: "",
    openaiApiKey: "",
    affiliateTag: "",
    notes: "",
  },
  mining: {
    walletAddress: "",
    walletLabel: "",
    poolName: "",
    poolApiKey: "",
    workerName: "",
    dashboardUrl: "",
    username: "",
    password: "",
    powerCostKwh: "",
    notes: "",
  },
  games: {
    zbdHandle: "",
    zbdApiKey: "",
    prolificEmail: "",
    surveyEmail: "",
    notes: "",
  },
  entertainment: {
    householdLabel: "",
    familyProfile: "",
    kidsProfile: "",
    defaultServiceId: "",
    deviceNotes: "",
    notes: "",
    accounts: [],
  },
  grow: {
    roomLabel: "",
    haUrl: "",
    haToken: "",
    deviceSlug: "",
    tempEntity: "",
    rhEntity: "",
    notes: "",
  },
  cameras: {
    wallLabel: "",
    frigateUrl: "",
    frigateApiKey: "",
    defaultGrid: "",
    nvrHost: "",
    nvrUser: "",
    nvrPass: "",
    notes: "",
    accounts: [],
  },
  custom: [],
  updatedAt: 0,
};

function cloneDefault(): OperatorVault {
  return JSON.parse(JSON.stringify(DEFAULT_OPERATOR_VAULT)) as OperatorVault;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeCustomEntry(value: unknown, index: number): VaultCustomEntry {
  const src = value && typeof value === "object" ? value as Partial<VaultCustomEntry> : {};
  return {
    id: text(src.id) || `custom-${index + 1}`,
    label: text(src.label),
    username: text(src.username),
    password: text(src.password),
    apiKey: text(src.apiKey),
    apiSecret: text(src.apiSecret),
    notes: text(src.notes),
  };
}

function sanitizeEntertainmentEntry(value: unknown, index: number): EntertainmentVaultEntry {
  const src = value && typeof value === "object" ? value as Partial<EntertainmentVaultEntry> : {};
  return {
    id: text(src.id) || `ent-${index + 1}`,
    serviceId: text(src.serviceId),
    label: text(src.label),
    username: text(src.username),
    password: text(src.password),
    profile: text(src.profile),
    pin: text(src.pin),
    apiKey: text(src.apiKey),
    apiSecret: text(src.apiSecret),
    notes: text(src.notes),
  };
}

function sanitizeCameraEntry(value: unknown, index: number): CameraVaultEntry {
  const src = value && typeof value === "object" ? value as Partial<CameraVaultEntry> : {};
  return {
    id: text(src.id) || `cam-${index + 1}`,
    label: text(src.label),
    location: text(src.location),
    url: text(src.url),
    username: text(src.username),
    password: text(src.password),
    pin: text(src.pin),
    apiKey: text(src.apiKey),
    apiSecret: text(src.apiSecret),
    notes: text(src.notes),
  };
}

export function createEntertainmentVaultEntry(seed?: Partial<EntertainmentVaultEntry>): EntertainmentVaultEntry {
  return sanitizeEntertainmentEntry({
    id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...seed,
  }, 0);
}

export function createCameraVaultEntry(seed?: Partial<CameraVaultEntry>): CameraVaultEntry {
  return sanitizeCameraEntry({
    id: `cam-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...seed,
  }, 0);
}

export function sanitizeOperatorVault(value: unknown): OperatorVault {
  const base = cloneDefault();
  const src = value && typeof value === "object" ? value as Partial<OperatorVault> : {};
  return {
    profile: {
      displayName: text(src.profile?.displayName),
      preferredName: text(src.profile?.preferredName),
      city: text(src.profile?.city),
      timeZone: text(src.profile?.timeZone),
      businessEmail: text(src.profile?.businessEmail),
    },
    trading: {
      broker: text(src.trading?.broker),
      username: text(src.trading?.username),
      password: text(src.trading?.password),
      apiKey: text(src.trading?.apiKey),
      apiSecret: text(src.trading?.apiSecret),
      accountId: text(src.trading?.accountId),
      defaultSymbol: text(src.trading?.defaultSymbol),
      watchlist: text(src.trading?.watchlist),
      scannerUrl: text(src.trading?.scannerUrl),
      notes: text(src.trading?.notes),
    },
    content: {
      kdpEmail: text(src.content?.kdpEmail),
      gumroadEmail: text(src.content?.gumroadEmail),
      gumroadApiKey: text(src.content?.gumroadApiKey),
      openaiApiKey: text(src.content?.openaiApiKey),
      affiliateTag: text(src.content?.affiliateTag),
      notes: text(src.content?.notes),
    },
    mining: {
      walletAddress: text(src.mining?.walletAddress),
      walletLabel: text(src.mining?.walletLabel),
      poolName: text(src.mining?.poolName),
      poolApiKey: text(src.mining?.poolApiKey),
      workerName: text(src.mining?.workerName),
      dashboardUrl: text(src.mining?.dashboardUrl),
      username: text(src.mining?.username),
      password: text(src.mining?.password),
      powerCostKwh: text(src.mining?.powerCostKwh),
      notes: text(src.mining?.notes),
    },
    games: {
      zbdHandle: text(src.games?.zbdHandle),
      zbdApiKey: text(src.games?.zbdApiKey),
      prolificEmail: text(src.games?.prolificEmail),
      surveyEmail: text(src.games?.surveyEmail),
      notes: text(src.games?.notes),
    },
    entertainment: {
      householdLabel: text(src.entertainment?.householdLabel),
      familyProfile: text(src.entertainment?.familyProfile),
      kidsProfile: text(src.entertainment?.kidsProfile),
      defaultServiceId: text(src.entertainment?.defaultServiceId),
      deviceNotes: text(src.entertainment?.deviceNotes),
      notes: text(src.entertainment?.notes),
      accounts: Array.isArray(src.entertainment?.accounts)
        ? src.entertainment.accounts.map(sanitizeEntertainmentEntry)
        : base.entertainment.accounts,
    },
    grow: {
      roomLabel: text(src.grow?.roomLabel),
      haUrl: text(src.grow?.haUrl),
      haToken: text(src.grow?.haToken),
      deviceSlug: text(src.grow?.deviceSlug),
      tempEntity: text(src.grow?.tempEntity),
      rhEntity: text(src.grow?.rhEntity),
      notes: text(src.grow?.notes),
    },
    cameras: {
      wallLabel: text(src.cameras?.wallLabel),
      frigateUrl: text(src.cameras?.frigateUrl),
      frigateApiKey: text(src.cameras?.frigateApiKey),
      defaultGrid: text(src.cameras?.defaultGrid),
      nvrHost: text(src.cameras?.nvrHost),
      nvrUser: text(src.cameras?.nvrUser),
      nvrPass: text(src.cameras?.nvrPass),
      notes: text(src.cameras?.notes),
      accounts: Array.isArray(src.cameras?.accounts)
        ? src.cameras.accounts.map(sanitizeCameraEntry)
        : base.cameras.accounts,
    },
    custom: Array.isArray(src.custom) ? src.custom.map(sanitizeCustomEntry) : base.custom,
    updatedAt: typeof src.updatedAt === "number" ? src.updatedAt : 0,
  };
}

function browserLoad(): OperatorVault {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return cloneDefault();
    return sanitizeOperatorVault(JSON.parse(raw));
  } catch {
    return cloneDefault();
  }
}

function browserSave(vault: OperatorVault): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(vault));
  } catch {
    // ignore quota/storage errors
  }
}

export async function loadOperatorVault(): Promise<OperatorVault> {
  const api = oddApi();
  if (api.vaultGet) {
    const res = await api.vaultGet();
    if (res?.ok) return sanitizeOperatorVault(res.data);
  }
  return browserLoad();
}

export async function saveOperatorVault(vault: OperatorVault): Promise<OperatorVaultStatus> {
  const next = sanitizeOperatorVault({ ...vault, updatedAt: Date.now() });
  const api = oddApi();
  if (api.vaultSet) {
    const res = await api.vaultSet(next);
    return {
      ok: !!res?.ok,
      mode: (res?.mode || "plain-json") as OperatorVaultStatus["mode"],
      encrypted: !!res?.encrypted,
      desktop: true,
      path: res?.path,
      error: res?.error,
    };
  }
  browserSave(next);
  return { ok: true, mode: "localStorage", encrypted: false, desktop: false };
}

export async function getOperatorVaultStatus(): Promise<OperatorVaultStatus> {
  const api = oddApi();
  if (api.vaultStatus) {
    const res = await api.vaultStatus();
    return {
      ok: !!res?.ok,
      mode: (res?.mode || "plain-json") as OperatorVaultStatus["mode"],
      encrypted: !!res?.encrypted,
      desktop: !!res?.desktop,
      path: res?.path,
      error: res?.error,
    };
  }
  return { ok: true, mode: "localStorage", encrypted: false, desktop: false };
}

export function countVaultSecrets(vault: OperatorVault): number {
  const values = [
    vault.trading.username,
    vault.trading.password,
    vault.trading.apiKey,
    vault.trading.apiSecret,
    vault.trading.accountId,
    vault.trading.defaultSymbol,
    vault.trading.watchlist,
    vault.trading.scannerUrl,
    vault.content.kdpEmail,
    vault.content.gumroadEmail,
    vault.content.gumroadApiKey,
    vault.content.openaiApiKey,
    vault.content.affiliateTag,
    vault.mining.walletAddress,
    vault.mining.walletLabel,
    vault.mining.poolApiKey,
    vault.mining.workerName,
    vault.mining.dashboardUrl,
    vault.mining.username,
    vault.mining.password,
    vault.mining.powerCostKwh,
    vault.games.zbdHandle,
    vault.games.zbdApiKey,
    vault.games.prolificEmail,
    vault.games.surveyEmail,
    vault.entertainment.householdLabel,
    vault.entertainment.familyProfile,
    vault.entertainment.kidsProfile,
    vault.grow.roomLabel,
    vault.grow.haUrl,
    vault.grow.haToken,
    vault.grow.deviceSlug,
    vault.grow.tempEntity,
    vault.grow.rhEntity,
    vault.cameras.wallLabel,
    vault.cameras.frigateUrl,
    vault.cameras.frigateApiKey,
    vault.cameras.defaultGrid,
    vault.cameras.nvrHost,
    vault.cameras.nvrUser,
    vault.cameras.nvrPass,
  ];
  let total = values.filter((v) => !!String(v || "").trim()).length;
  total += vault.entertainment.accounts.reduce((sum, item) => {
    return sum + [item.label, item.username, item.password, item.profile, item.pin, item.apiKey, item.apiSecret].filter((v) => !!String(v || "").trim()).length;
  }, 0);
  total += vault.cameras.accounts.reduce((sum, item) => {
    return sum + [item.label, item.location, item.url, item.username, item.password, item.pin, item.apiKey, item.apiSecret].filter((v) => !!String(v || "").trim()).length;
  }, 0);
  total += vault.custom.reduce((sum, item) => {
    return sum + [item.label, item.username, item.password, item.apiKey, item.apiSecret].filter((v) => !!String(v || "").trim()).length;
  }, 0);
  return total;
}
