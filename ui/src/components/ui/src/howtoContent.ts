export const HOWTO: Record<string, {title: string; sections: {heading: string; bullets: string[]}[]}> = {
  "DevEngine": {
    "title": "Dev Engine \u2014 How to Use",
    "sections": [
      {
        "heading": "What it is",
        "bullets": [
          "Your project launcher + build console.",
          "Shows build status (Idle/Running/Failed) and keeps a recent log tail for Homie."
        ]
      },
      {
        "heading": "Basic workflow",
        "bullets": [
          "Run a task (dev/build/dist) from inside Dev Engine so logs stream into the UI.",
          "If something fails, open Homie \ud83d\udc4a \u2192 Dev Awareness \u2192 Refresh \u2192 Suggested fixes."
        ]
      },
      {
        "heading": "Logs & status",
        "bullets": [
          "Use Filters to focus on errors/warnings.",
          "Copy/export the log tail when sharing an issue."
        ]
      },
      {
        "heading": "Homie playbooks",
        "bullets": [
          "Run one-click playbooks (Clean reinstall / Verify build / Fix common issues).",
          "Confirmation gate is required before any destructive step."
        ]
      },
      {
        "heading": "Shortcuts",
        "bullets": [
          "Tip: keep one project as the default Target Project (OddEngine is preselected)."
        ]
      }
    ]
  },
  "Autopilot": {
    "title": "Autopilot \u2014 How to Use",
    "sections": [
      {
        "heading": "What it is",
        "bullets": [
          "Safe generators that create real files (templates, dashboards, microsites).",
          "Designed to never overwrite without you explicitly choosing the output folder."
        ]
      },
      {
        "heading": "Web vs Desktop mode",
        "bullets": [
          "Web mode: use \u201cExport to Folder\u201d (browser permission prompt).",
          "Desktop mode: generators can write directly to disk."
        ]
      },
      {
        "heading": "Typical workflow",
        "bullets": [
          "Pick a generator \u2192 fill inputs \u2192 Generate \u2192 Open output folder \u2192 verify files."
        ]
      },
      {
        "heading": "Safety",
        "bullets": [
          "If a generator needs Desktop mode for disk access, the UI will tell you.",
          "Generated outputs are placed in an exports folder you control."
        ]
      }
    ]
  },
  "Builder": {
    "title": "Builder \u2014 How to Use",
    "sections": [
      {
        "heading": "What it is",
        "bullets": [
          "UI canvas + scene graph + inspector to design layouts quickly."
        ]
      },
      {
        "heading": "Core controls",
        "bullets": [
          "Canvas: click to select nodes.",
          "Scene Graph: see hierarchy and select elements.",
          "Inspector: edit position/size/style keys."
        ]
      },
      {
        "heading": "Export",
        "bullets": [
          "Export React: copies a component you can paste into a project.",
          "Export Scene JSON: saves the scene structure for later reload."
        ]
      },
      {
        "heading": "Tip",
        "bullets": [
          "Keep the canvas simple; build reusable widgets and export them."
        ]
      }
    ]
  },
  "Plugins": {
    "title": "Plugins \u2014 How to Use",
    "sections": [
      {
        "heading": "What it is",
        "bullets": [
          "Drop-in feature packs so you can add new tools without rewriting the OS."
        ]
      },
      {
        "heading": "Add a plugin",
        "bullets": [
          "Desktop: drop a folder with *.plugin.json into your Plugins folder, then Reload.",
          "Web: import a plugin manifest (stored locally)."
        ]
      },
      {
        "heading": "What a plugin can do",
        "bullets": [
          "Expose UI (ui.html) inside OddEngine.",
          "Register actions (open links, run desktop tasks, generators)."
        ]
      },
      {
        "heading": "Safety",
        "bullets": [
          "Plugins are local-only by default. Review the manifest before enabling."
        ]
      }
    ]
  },
  "FamilyBudget": {
    "title": "Family Budget — How to Use",
    "sections": [
      {
        "heading": "What it is",
        "bullets": [
          "A local-first household budget dashboard adapted from your Budget OS starter zip.",
          "It tracks accounts, transactions, budget buckets, goals, recurring bills, annual planning, and connector health without needing a backend."
        ]
      },
      {
        "heading": "Best workflow",
        "bullets": [
          "Start on Overview to see net worth, this month’s cashflow, and budget progress.",
          "Use Transactions for quick manual entries, Budget for monthly guardrails, Goals for savings progress, and Plan for yearly planning."
        ]
      },
      {
        "heading": "Import / export",
        "bullets": [
          "Use Seed demo household to restore the imported sample data anytime.",
          "Export JSON saves your full local state; Import JSON restores a saved snapshot on this device."
        ]
      },
      {
        "heading": "Tip",
        "bullets": [
          "Keep this panel as the family control tower: bills, safety buffer, debt, and net worth in one place.",
          "It is local-first right now, so it’s safe for planning even before live account syncs are wired."
        ]
      }
    ]
  },
  "Money": {
    "title": "Money \u2014 How to Use",
    "sections": [
      {
        "heading": "What it is",
        "bullets": [
          "Your ROI tier dashboard (Tier 1 \u2192 Tier 3) with actions and notes."
        ]
      },
      {
        "heading": "Workflow",
        "bullets": [
          "Pick a tier \u2192 add an action \u2192 track status \u2192 export a plan as .md/.txt."
        ]
      },
      {
        "heading": "Tip",
        "bullets": [
          "Keep Tier 1 tight (Trading/Crypto tools/Affiliate sites). Ship small, repeat."
        ]
      }
    ]
  },
  "Cannabis": {
    title: "Cannabis Hub",
    icon: "🍃",
    bullets: [
      "Discover: opens Weedmaps/Leafly/Dutchie/Eaze/AllBud searches near your ZIP (browser).",
      "Deals: paste deal text → built‑in scoring (best overall: value + clarity + fewer restrictions) → save + filter.",
      "Favorites: save key dispensary/resource links + optional address for mapping.",
      "Map: pin favorites by address (uses OpenStreetMap geocoding) and view on an embedded map.",
      "Ask Homie: Desktop-only chat that compares your saved/pasted info (does not fetch live deals).",
      "Settings: manage your own categories + price tiers + reset Cannabis-only state."
    ],
    hotkeys: ["F1 — How To (global)"]
  },
  "Trading": {
    "title": "Trading — How to Use",
    "sections": [
      {
        "heading": "What it is",
        "bullets": [
          "Options Sniper scoring plus Public.com scanner modes (website fallback or authenticated API mode).",
          "Includes a TradingView-style chart, real expiration picker, greeks refresh, and a mobile-style option detail drawer."
        ]
      },
      {
        "heading": "Public API key mode",
        "bullets": [
          "Paste your Public secret key, create an access token, then load accounts to auto-fill your accountId.",
          "API mode is the best path when you want live expirations, richer chain rows, and greeks inside the panel."
        ]
      },
      {
        "heading": "Scanner workflow",
        "bullets": [
          "Pick your symbol, load expirations, choose an expiry, then click Scan symbol.",
          "Use Scan watchlist to rank best calls and puts across your tracked tickers with the same filters."
        ]
      },
      {
        "heading": "Contracts + drawer",
        "bullets": [
          "Click any contract row to open the detail drawer with bid/ask/last, breakeven, volume, open interest, and greeks.",
          "Pinned contract details flow straight into the Sniper plan preview and markdown export."
        ]
      }
    ]
  },
  "Mining": {
    "title": "Mining \u2014 How to Use",
    "sections": [
      {
        "heading": "What it is",
        "bullets": [
          "A local hub for mining notes + dashboard hooks (profitability, pools, rigs)."
        ]
      },
      {
        "heading": "Workflow",
        "bullets": [
          "Track your rigs, pools, and coins you care about.",
          "Use exports to keep configs and notes portable."
        ]
      },
      {
        "heading": "Tip",
        "bullets": [
          "Keep one \u2018default rig\u2019 template and clone it per machine."
        ]
      }
    ]
  },
  "OptionsSaaS": {
    "title": "Options SaaS \u2014 How to Use",
    "sections": [
      {
        "heading": "What it is",
        "bullets": [
          "Idea/spec board for your Options SaaS (features, sprints, releases)."
        ]
      },
      {
        "heading": "Workflow",
        "bullets": [
          "Capture the user story \u2192 acceptance criteria \u2192 UI notes \u2192 export roadmap.",
          "Use this panel to keep scope tight and versioned."
        ]
      },
      {
        "heading": "Tip",
        "bullets": [
          "Ship MVP: scanner \u2192 watchlist \u2192 signal cards \u2192 export reports."
        ]
      }
    ]
  },
  "Preferences": {
    "title": "Preferences — How to Use",
    "sections": [
      {
        "heading": "What it is",
        "bullets": [
          "A single place to store default settings for Grow, Cameras, Crypto Games/ZBD, Desktop mode, and Cannabis.",
          "All settings are saved locally on this device (localStorage)."
        ]
      },
      {
        "heading": "How it helps",
        "bullets": [
          "Pre-fills common values so you don’t retype them every session (ZIP, grid layout, emulator preference, etc.).",
          "You can still override anything inside each panel."
        ]
      }
    ]
  }
} as const;
