import { loadJSON, saveJSON } from "./storage";
import { type Prefs, DEFAULT_PREFS } from "./prefs";
import { type OperatorVault, type OperatorProfile } from "./operatorVault";

export const MASTER_SETUP_KEY = "oddengine:master-setup:v1";
const TRADING_KEY = "oddengine:trading:sniper:v4";
const MINING_KEY = "oddengine:mining:v1";
const GROW_PROFILE_KEY = "oddengine:grow:profile";
const GROW_LIVE_KEY = "oddengine:grow:live:v2";
const CAMERAS_KEY = "oddengine:cameras:v1";
const ROUTINES_KEY = "oddengine:routines:v1";

export type MasterSetup = {
  profile: OperatorProfile;
  money: {
    weeklyIncomeTarget: string;
    monthlyIncomeTarget: string;
    roughDayMinutes: string;
    goodDayMinutes: string;
    topLanes: string;
  };
  trading: {
    broker: string;
    defaultSymbol: string;
    watchlist: string;
    scannerUrl: string;
    accountId: string;
    apiKey: string;
    apiSecret: string;
  };
  mining: {
    walletLabel: string;
    walletAddress: string;
    poolName: string;
    workerName: string;
    dashboardUrl: string;
    powerCostKwh: string;
  };
  grow: {
    roomLabel: string;
    stage: "seedling" | "veg" | "flower" | "dry";
    lightsOn: string;
    lightsOff: string;
    haUrl: string;
    haToken: string;
    deviceSlug: string;
    tempEntity: string;
    rhEntity: string;
  };
  cameras: {
    wallLabel: string;
    frigateUrl: string;
    defaultGrid: "2x2" | "3x2" | "3x3" | "4x3" | "6x2";
    nvrHost: string;
    nvrUser: string;
    nvrPass: string;
  };
  content: {
    kdpEmail: string;
    gumroadEmail: string;
    gumroadApiKey: string;
    openaiApiKey: string;
    affiliateTag: string;
  };
  games: {
    zbdHandle: string;
    zbdApiKey: string;
    prolificEmail: string;
    surveyEmail: string;
    preferredEmulator: "auto" | "bluestacks" | "ldplayer" | "nox" | "memu" | "androidstudio";
  };
  routines: {
    morning: string;
    recovery: string;
    money: string;
    shutdown: string;
  };
};

export const DEFAULT_MASTER_SETUP: MasterSetup = {
  profile: {
    displayName: "",
    preferredName: "",
    city: "",
    timeZone: "America/Los_Angeles",
    businessEmail: "",
  },
  money: {
    weeklyIncomeTarget: "",
    monthlyIncomeTarget: "",
    roughDayMinutes: "15",
    goodDayMinutes: "90",
    topLanes: "GPTs, templates, affiliate, trading, mining, games",
  },
  trading: {
    broker: "",
    defaultSymbol: "SPY",
    watchlist: "SPY, QQQ, IWM, NVDA, TSLA, AAPL",
    scannerUrl: "",
    accountId: "",
    apiKey: "",
    apiSecret: "",
  },
  mining: {
    walletLabel: "",
    walletAddress: "",
    poolName: "",
    workerName: "",
    dashboardUrl: "",
    powerCostKwh: "",
  },
  grow: {
    roomLabel: "",
    stage: "veg",
    lightsOn: "06:00",
    lightsOff: "00:00",
    haUrl: "",
    haToken: "",
    deviceSlug: "",
    tempEntity: "",
    rhEntity: "",
  },
  cameras: {
    wallLabel: "",
    frigateUrl: "",
    defaultGrid: "4x3",
    nvrHost: "",
    nvrUser: "",
    nvrPass: "",
  },
  content: {
    kdpEmail: "",
    gumroadEmail: "",
    gumroadApiKey: "",
    openaiApiKey: "",
    affiliateTag: "",
  },
  games: {
    zbdHandle: "",
    zbdApiKey: "",
    prolificEmail: "",
    surveyEmail: "",
    preferredEmulator: "auto",
  },
  routines: {
    morning: "Hydrate\nCheck in with Homie\nOpen Money\nOpen Happy Healthy",
    recovery: "Hydrate\nTake meds / supplements\nLog symptoms\nPick one low-friction money move",
    money: "Open Money\nRun Income Sniper\nChoose Today’s Best Move\nLog outcome",
    shutdown: "Review wins\nMark tomorrow priorities\nHydrate\nClose popouts",
  },
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function csv(value: unknown, fallback = "") {
  if (Array.isArray(value)) return value.map((item) => text(item).trim()).filter(Boolean).join(", ");
  return text(value, fallback);
}

function stageValue(value: unknown): MasterSetup["grow"]["stage"] {
  const v = text(value).toLowerCase();
  if (v === "seedling" || v === "veg" || v === "flower" || v === "dry") return v;
  return "veg";
}

function gridValue(value: unknown): MasterSetup["cameras"]["defaultGrid"] {
  const v = text(value);
  if (v === "2x2" || v === "3x2" || v === "3x3" || v === "4x3" || v === "6x2") return v;
  return "4x3";
}

function emulatorValue(value: unknown): MasterSetup["games"]["preferredEmulator"] {
  const v = text(value);
  if (v === "auto" || v === "bluestacks" || v === "ldplayer" || v === "nox" || v === "memu" || v === "androidstudio") return v;
  return "auto";
}

export function sanitizeMasterSetup(value: unknown): MasterSetup {
  const src = value && typeof value === "object" ? (value as Partial<MasterSetup>) : {};
  return {
    profile: {
      displayName: text(src.profile?.displayName),
      preferredName: text(src.profile?.preferredName),
      city: text(src.profile?.city),
      timeZone: text(src.profile?.timeZone, "America/Los_Angeles"),
      businessEmail: text(src.profile?.businessEmail),
    },
    money: {
      weeklyIncomeTarget: text(src.money?.weeklyIncomeTarget),
      monthlyIncomeTarget: text(src.money?.monthlyIncomeTarget),
      roughDayMinutes: text(src.money?.roughDayMinutes, "15"),
      goodDayMinutes: text(src.money?.goodDayMinutes, "90"),
      topLanes: csv(src.money?.topLanes, DEFAULT_MASTER_SETUP.money.topLanes),
    },
    trading: {
      broker: text(src.trading?.broker),
      defaultSymbol: text(src.trading?.defaultSymbol, "SPY"),
      watchlist: csv(src.trading?.watchlist, DEFAULT_MASTER_SETUP.trading.watchlist),
      scannerUrl: text(src.trading?.scannerUrl),
      accountId: text(src.trading?.accountId),
      apiKey: text(src.trading?.apiKey),
      apiSecret: text(src.trading?.apiSecret),
    },
    mining: {
      walletLabel: text(src.mining?.walletLabel),
      walletAddress: text(src.mining?.walletAddress),
      poolName: text(src.mining?.poolName),
      workerName: text(src.mining?.workerName),
      dashboardUrl: text(src.mining?.dashboardUrl),
      powerCostKwh: text(src.mining?.powerCostKwh),
    },
    grow: {
      roomLabel: text(src.grow?.roomLabel),
      stage: stageValue(src.grow?.stage),
      lightsOn: text(src.grow?.lightsOn, "06:00"),
      lightsOff: text(src.grow?.lightsOff, "00:00"),
      haUrl: text(src.grow?.haUrl),
      haToken: text(src.grow?.haToken),
      deviceSlug: text(src.grow?.deviceSlug),
      tempEntity: text(src.grow?.tempEntity),
      rhEntity: text(src.grow?.rhEntity),
    },
    cameras: {
      wallLabel: text(src.cameras?.wallLabel),
      frigateUrl: text(src.cameras?.frigateUrl),
      defaultGrid: gridValue(src.cameras?.defaultGrid),
      nvrHost: text(src.cameras?.nvrHost),
      nvrUser: text(src.cameras?.nvrUser),
      nvrPass: text(src.cameras?.nvrPass),
    },
    content: {
      kdpEmail: text(src.content?.kdpEmail),
      gumroadEmail: text(src.content?.gumroadEmail),
      gumroadApiKey: text(src.content?.gumroadApiKey),
      openaiApiKey: text(src.content?.openaiApiKey),
      affiliateTag: text(src.content?.affiliateTag),
    },
    games: {
      zbdHandle: text(src.games?.zbdHandle),
      zbdApiKey: text(src.games?.zbdApiKey),
      prolificEmail: text(src.games?.prolificEmail),
      surveyEmail: text(src.games?.surveyEmail),
      preferredEmulator: emulatorValue(src.games?.preferredEmulator),
    },
    routines: {
      morning: text(src.routines?.morning, DEFAULT_MASTER_SETUP.routines.morning),
      recovery: text(src.routines?.recovery, DEFAULT_MASTER_SETUP.routines.recovery),
      money: text(src.routines?.money, DEFAULT_MASTER_SETUP.routines.money),
      shutdown: text(src.routines?.shutdown, DEFAULT_MASTER_SETUP.routines.shutdown),
    },
  };
}

export function loadMasterSetup(): MasterSetup {
  return sanitizeMasterSetup(loadJSON(MASTER_SETUP_KEY, DEFAULT_MASTER_SETUP));
}

export function saveMasterSetup(setup: MasterSetup) {
  saveJSON(MASTER_SETUP_KEY, sanitizeMasterSetup(setup));
}

export function mergeMasterSetupIntoVault(vault: OperatorVault, setup: MasterSetup): OperatorVault {
  const next = {
    ...vault,
    profile: { ...vault.profile, ...setup.profile },
    trading: {
      ...vault.trading,
      broker: setup.trading.broker || vault.trading.broker,
      defaultSymbol: setup.trading.defaultSymbol || vault.trading.defaultSymbol,
      watchlist: setup.trading.watchlist || vault.trading.watchlist,
      scannerUrl: setup.trading.scannerUrl || vault.trading.scannerUrl,
      accountId: setup.trading.accountId || vault.trading.accountId,
      apiKey: setup.trading.apiKey || vault.trading.apiKey,
      apiSecret: setup.trading.apiSecret || vault.trading.apiSecret,
    },
    content: {
      ...vault.content,
      kdpEmail: setup.content.kdpEmail || vault.content.kdpEmail,
      gumroadEmail: setup.content.gumroadEmail || vault.content.gumroadEmail,
      gumroadApiKey: setup.content.gumroadApiKey || vault.content.gumroadApiKey,
      openaiApiKey: setup.content.openaiApiKey || vault.content.openaiApiKey,
      affiliateTag: setup.content.affiliateTag || vault.content.affiliateTag,
    },
    mining: {
      ...vault.mining,
      walletLabel: setup.mining.walletLabel || vault.mining.walletLabel,
      walletAddress: setup.mining.walletAddress || vault.mining.walletAddress,
      poolName: setup.mining.poolName || vault.mining.poolName,
      workerName: setup.mining.workerName || vault.mining.workerName,
      dashboardUrl: setup.mining.dashboardUrl || vault.mining.dashboardUrl,
      powerCostKwh: setup.mining.powerCostKwh || vault.mining.powerCostKwh,
    },
    games: {
      ...vault.games,
      zbdHandle: setup.games.zbdHandle || vault.games.zbdHandle,
      zbdApiKey: setup.games.zbdApiKey || vault.games.zbdApiKey,
      prolificEmail: setup.games.prolificEmail || vault.games.prolificEmail,
      surveyEmail: setup.games.surveyEmail || vault.games.surveyEmail,
    },
    grow: {
      ...vault.grow,
      roomLabel: setup.grow.roomLabel || vault.grow.roomLabel,
      haUrl: setup.grow.haUrl || vault.grow.haUrl,
      haToken: setup.grow.haToken || vault.grow.haToken,
      deviceSlug: setup.grow.deviceSlug || vault.grow.deviceSlug,
      tempEntity: setup.grow.tempEntity || vault.grow.tempEntity,
      rhEntity: setup.grow.rhEntity || vault.grow.rhEntity,
    },
    cameras: {
      ...vault.cameras,
      wallLabel: setup.cameras.wallLabel || vault.cameras.wallLabel,
      frigateUrl: setup.cameras.frigateUrl || vault.cameras.frigateUrl,
      defaultGrid: setup.cameras.defaultGrid || vault.cameras.defaultGrid,
      nvrHost: setup.cameras.nvrHost || vault.cameras.nvrHost,
      nvrUser: setup.cameras.nvrUser || vault.cameras.nvrUser,
      nvrPass: setup.cameras.nvrPass || vault.cameras.nvrPass,
    },
    updatedAt: Date.now(),
  } satisfies OperatorVault;
  return next;
}

export function mergeMasterSetupIntoPrefs(prefs: Prefs, setup: MasterSetup): Prefs {
  return {
    ...prefs,
    grow: {
      ...prefs.grow,
      name: setup.grow.roomLabel || prefs.grow.name,
      stage: setup.grow.stage || prefs.grow.stage,
      lightsOn: setup.grow.lightsOn || prefs.grow.lightsOn,
      lightsOff: setup.grow.lightsOff || prefs.grow.lightsOff,
    },
    cameras: {
      ...prefs.cameras,
      grid: setup.cameras.defaultGrid || prefs.cameras.grid,
    },
    zbd: {
      ...prefs.zbd,
      preferredEmulator: setup.games.preferredEmulator || prefs.zbd.preferredEmulator,
    },
    desktop: {
      ...prefs.desktop,
      startPanel: prefs.desktop.startPanel || DEFAULT_PREFS.desktop.startPanel,
    },
  };
}

function ensureTradingChartSymbol(symbol: string) {
  const clean = String(symbol || "").trim().toUpperCase();
  if (!clean) return DEFAULT_MASTER_SETUP.trading.defaultSymbol;
  if (clean.includes(":")) return clean;
  return `AMEX:${clean}`;
}

function buildTradingInput(setup: MasterSetup) {
  const symbol = String(setup.trading.defaultSymbol || DEFAULT_MASTER_SETUP.trading.defaultSymbol).trim().toUpperCase();
  return {
    symbol: symbol || "SPY",
    chartSymbol: ensureTradingChartSymbol(symbol || "SPY"),
    chartInterval: "15",
    bias: "bull",
    timeframe: "0dte",
    setup: "vwap_flip",
    env: 70,
    heat: 70,
    traps: { chop: false, news: false, wideSpreads: false, fakeBreaks: false },
    levels: "",
    notes: "",
    watchlist: setup.trading.watchlist || DEFAULT_MASTER_SETUP.trading.watchlist,
    maxAsk: 5,
    minOi: 100,
    targetSide: "all",
    sortBy: "score",
    dataMode: "website",
    publicSecretKey: setup.trading.apiSecret || "",
    publicAccessToken: setup.trading.apiKey || "",
    publicAccountId: setup.trading.accountId || "",
    selectedExpiration: "",
    contractSearch: "",
    strikeGrouping: "5",
  };
}

function buildGrowProfile(setup: MasterSetup) {
  return {
    name: setup.grow.roomLabel || DEFAULT_PREFS.grow.name,
    size: "",
    stage: setup.grow.stage,
    lightsOn: setup.grow.lightsOn || DEFAULT_PREFS.grow.lightsOn,
    lightsOff: setup.grow.lightsOff || DEFAULT_PREFS.grow.lightsOff,
    notes: "",
  };
}

function buildGrowLive(setup: MasterSetup) {
  return {
    enabled: Boolean(setup.grow.haUrl || setup.grow.tempEntity || setup.grow.rhEntity),
    source: "ha_acinfinity",
    haUrl: setup.grow.haUrl || "",
    token: setup.grow.haToken || "",
    tempEntity: setup.grow.tempEntity || "",
    rhEntity: setup.grow.rhEntity || "",
    deviceSlug: setup.grow.deviceSlug || "",
    pollSec: 15,
    autoLog: false,
    lastSyncTs: null,
    lastError: "",
  };
}

function buildMiningState(setup: MasterSetup) {
  const poolId = setup.mining.poolName ? `pool_${Date.now().toString(36)}` : "";
  const minerId = setup.mining.workerName ? `miner_${Date.now().toString(36)}` : "";
  return {
    miners: setup.mining.workerName ? [{ id: minerId, name: setup.mining.workerName, algo: "SHA-256", hashrate: 0, unit: "TH/s", powerW: 0, poolId }] : [],
    pools: setup.mining.poolName ? [{ id: poolId, name: setup.mining.poolName, coin: "BTC", url: setup.mining.dashboardUrl || "", payoutThresholdSats: undefined, notes: setup.mining.walletLabel || "" }] : [],
    payouts: [],
    alertCfg: { noPayoutHours: 24 },
  };
}

function buildCamerasState(setup: MasterSetup) {
  const host = setup.cameras.nvrHost.trim();
  return {
    nvrs: host ? [{ id: `nvr_${Date.now().toString(36)}`, name: setup.cameras.wallLabel || "Default NVR", host, user: setup.cameras.nvrUser || "", pass: setup.cameras.nvrPass || "" }] : [],
    cameras: [],
    wall: { grid: setup.cameras.defaultGrid || "4x3", page: 0, live: true },
  };
}

function buildRoutineSequence(name: string, body: string, mode: "windows" | "main" = "main") {
  return {
    id: `routine_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    name,
    setName: name,
    sequence: body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    mode,
    tileStyle: "hero",
    tilePreset: "single",
    notes: "Created from Master Setup Wizard.",
    updatedAt: Date.now(),
  };
}

function buildRoutineStore(setup: MasterSetup) {
  const routines = [
    buildRoutineSequence("Morning", setup.routines.morning),
    buildRoutineSequence("Recovery", setup.routines.recovery),
    buildRoutineSequence("Money", setup.routines.money),
    buildRoutineSequence("Shutdown", setup.routines.shutdown),
  ];
  return {
    activeId: routines[0]?.id || "",
    routines,
  };
}

export function applyMasterSetupToPanels(setup: MasterSetup) {
  const tradingBase = buildTradingInput(setup);
  const tradingCurrent = loadJSON<any>(TRADING_KEY, null as any) || {};
  saveJSON(TRADING_KEY, {
    ...tradingBase,
    ...tradingCurrent,
    symbol: tradingCurrent?.symbol || tradingBase.symbol,
    chartSymbol: tradingCurrent?.chartSymbol || tradingBase.chartSymbol,
    watchlist: tradingCurrent?.watchlist || tradingBase.watchlist,
    publicAccessToken: tradingCurrent?.publicAccessToken || tradingBase.publicAccessToken,
    publicSecretKey: tradingCurrent?.publicSecretKey || tradingBase.publicSecretKey,
    publicAccountId: tradingCurrent?.publicAccountId || tradingBase.publicAccountId,
  });

  const miningBase = buildMiningState(setup);
  const miningCurrent = loadJSON<any>(MINING_KEY, null as any) || {};
  saveJSON(MINING_KEY, {
    ...miningBase,
    ...miningCurrent,
    pools: Array.isArray(miningCurrent?.pools) && miningCurrent.pools.length ? miningCurrent.pools : miningBase.pools,
    miners: Array.isArray(miningCurrent?.miners) && miningCurrent.miners.length ? miningCurrent.miners : miningBase.miners,
    payouts: Array.isArray(miningCurrent?.payouts) ? miningCurrent.payouts : miningBase.payouts,
    alertCfg: miningCurrent?.alertCfg || miningBase.alertCfg,
  });

  const growProfileBase = buildGrowProfile(setup);
  const growProfileCurrent = loadJSON<any>(GROW_PROFILE_KEY, null as any) || {};
  saveJSON(GROW_PROFILE_KEY, {
    ...growProfileBase,
    ...growProfileCurrent,
    name: growProfileCurrent?.name || growProfileBase.name,
    stage: growProfileCurrent?.stage || growProfileBase.stage,
    lightsOn: growProfileCurrent?.lightsOn || growProfileBase.lightsOn,
    lightsOff: growProfileCurrent?.lightsOff || growProfileBase.lightsOff,
  });

  const growLiveBase = buildGrowLive(setup);
  const growLiveCurrent = loadJSON<any>(GROW_LIVE_KEY, null as any) || {};
  saveJSON(GROW_LIVE_KEY, {
    ...growLiveBase,
    ...growLiveCurrent,
    haUrl: growLiveCurrent?.haUrl || growLiveBase.haUrl,
    token: growLiveCurrent?.token || growLiveBase.token,
    tempEntity: growLiveCurrent?.tempEntity || growLiveBase.tempEntity,
    rhEntity: growLiveCurrent?.rhEntity || growLiveBase.rhEntity,
    deviceSlug: growLiveCurrent?.deviceSlug || growLiveBase.deviceSlug,
  });

  const camerasBase = buildCamerasState(setup);
  const camerasCurrent = loadJSON<any>(CAMERAS_KEY, null as any) || {};
  saveJSON(CAMERAS_KEY, {
    ...camerasBase,
    ...camerasCurrent,
    nvrs: Array.isArray(camerasCurrent?.nvrs) && camerasCurrent.nvrs.length ? camerasCurrent.nvrs : camerasBase.nvrs,
    cameras: Array.isArray(camerasCurrent?.cameras) ? camerasCurrent.cameras : camerasBase.cameras,
    wall: {
      ...camerasBase.wall,
      ...(camerasCurrent?.wall || {}),
      grid: camerasCurrent?.wall?.grid || camerasBase.wall.grid,
    },
  });

  const routineBase = buildRoutineStore(setup);
  const routineCurrent = loadJSON<any>(ROUTINES_KEY, null as any) || { activeId: "", routines: [] };
  const currentRoutines = Array.isArray(routineCurrent?.routines) ? routineCurrent.routines : [];
  const mergedRoutines = [...currentRoutines];
  for (const candidate of routineBase.routines) {
    if (!mergedRoutines.some((item: any) => String(item?.name || "").trim().toLowerCase() === String(candidate.name).trim().toLowerCase())) {
      mergedRoutines.push(candidate);
    }
  }
  saveJSON(ROUTINES_KEY, {
    activeId: routineCurrent?.activeId || routineBase.activeId,
    routines: mergedRoutines,
  });
}

export function buildMasterSetupFromVaultAndPrefs(vault: OperatorVault, prefs: Prefs, current?: MasterSetup): MasterSetup {
  const base = current || DEFAULT_MASTER_SETUP;
  return sanitizeMasterSetup({
    ...base,
    profile: {
      displayName: vault.profile.displayName || base.profile.displayName,
      preferredName: vault.profile.preferredName || base.profile.preferredName,
      city: vault.profile.city || base.profile.city,
      timeZone: vault.profile.timeZone || base.profile.timeZone,
      businessEmail: vault.profile.businessEmail || base.profile.businessEmail,
    },
    trading: {
      broker: vault.trading.broker || base.trading.broker,
      defaultSymbol: vault.trading.defaultSymbol || base.trading.defaultSymbol,
      watchlist: vault.trading.watchlist || base.trading.watchlist,
      scannerUrl: vault.trading.scannerUrl || base.trading.scannerUrl,
      accountId: vault.trading.accountId || base.trading.accountId,
      apiKey: vault.trading.apiKey || base.trading.apiKey,
      apiSecret: vault.trading.apiSecret || base.trading.apiSecret,
    },
    mining: {
      walletLabel: vault.mining.walletLabel || base.mining.walletLabel,
      walletAddress: vault.mining.walletAddress || base.mining.walletAddress,
      poolName: vault.mining.poolName || base.mining.poolName,
      workerName: vault.mining.workerName || base.mining.workerName,
      dashboardUrl: vault.mining.dashboardUrl || base.mining.dashboardUrl,
      powerCostKwh: vault.mining.powerCostKwh || base.mining.powerCostKwh,
    },
    grow: {
      roomLabel: vault.grow.roomLabel || prefs.grow.name || base.grow.roomLabel,
      stage: prefs.grow.stage || base.grow.stage,
      lightsOn: prefs.grow.lightsOn || base.grow.lightsOn,
      lightsOff: prefs.grow.lightsOff || base.grow.lightsOff,
      haUrl: vault.grow.haUrl || base.grow.haUrl,
      haToken: vault.grow.haToken || base.grow.haToken,
      deviceSlug: vault.grow.deviceSlug || base.grow.deviceSlug,
      tempEntity: vault.grow.tempEntity || base.grow.tempEntity,
      rhEntity: vault.grow.rhEntity || base.grow.rhEntity,
    },
    cameras: {
      wallLabel: vault.cameras.wallLabel || base.cameras.wallLabel,
      frigateUrl: vault.cameras.frigateUrl || base.cameras.frigateUrl,
      defaultGrid: gridValue(vault.cameras.defaultGrid || prefs.cameras.grid || base.cameras.defaultGrid),
      nvrHost: vault.cameras.nvrHost || base.cameras.nvrHost,
      nvrUser: vault.cameras.nvrUser || base.cameras.nvrUser,
      nvrPass: vault.cameras.nvrPass || base.cameras.nvrPass,
    },
    content: {
      kdpEmail: vault.content.kdpEmail || base.content.kdpEmail,
      gumroadEmail: vault.content.gumroadEmail || base.content.gumroadEmail,
      gumroadApiKey: vault.content.gumroadApiKey || base.content.gumroadApiKey,
      openaiApiKey: vault.content.openaiApiKey || base.content.openaiApiKey,
      affiliateTag: vault.content.affiliateTag || base.content.affiliateTag,
    },
    games: {
      zbdHandle: vault.games.zbdHandle || base.games.zbdHandle,
      zbdApiKey: vault.games.zbdApiKey || base.games.zbdApiKey,
      prolificEmail: vault.games.prolificEmail || base.games.prolificEmail,
      surveyEmail: vault.games.surveyEmail || base.games.surveyEmail,
      preferredEmulator: prefs.zbd.preferredEmulator || base.games.preferredEmulator,
    },
  });
}

export function countMasterSetupFilled(setup: MasterSetup) {
  const values = [
    setup.profile.displayName,
    setup.profile.preferredName,
    setup.profile.city,
    setup.profile.timeZone,
    setup.profile.businessEmail,
    setup.money.weeklyIncomeTarget,
    setup.money.monthlyIncomeTarget,
    setup.money.roughDayMinutes,
    setup.money.goodDayMinutes,
    setup.money.topLanes,
    setup.trading.broker,
    setup.trading.defaultSymbol,
    setup.trading.watchlist,
    setup.trading.scannerUrl,
    setup.trading.accountId,
    setup.trading.apiKey,
    setup.trading.apiSecret,
    setup.mining.walletLabel,
    setup.mining.walletAddress,
    setup.mining.poolName,
    setup.mining.workerName,
    setup.mining.dashboardUrl,
    setup.mining.powerCostKwh,
    setup.grow.roomLabel,
    setup.grow.lightsOn,
    setup.grow.lightsOff,
    setup.grow.haUrl,
    setup.grow.haToken,
    setup.grow.deviceSlug,
    setup.grow.tempEntity,
    setup.grow.rhEntity,
    setup.cameras.wallLabel,
    setup.cameras.frigateUrl,
    setup.cameras.defaultGrid,
    setup.cameras.nvrHost,
    setup.cameras.nvrUser,
    setup.cameras.nvrPass,
    setup.content.kdpEmail,
    setup.content.gumroadEmail,
    setup.content.gumroadApiKey,
    setup.content.openaiApiKey,
    setup.content.affiliateTag,
    setup.games.zbdHandle,
    setup.games.zbdApiKey,
    setup.games.prolificEmail,
    setup.games.surveyEmail,
    setup.routines.morning,
    setup.routines.recovery,
    setup.routines.money,
    setup.routines.shutdown,
  ];
  const filled = values.filter((value) => String(value || "").trim()).length;
  return { filled, total: values.length };
}
