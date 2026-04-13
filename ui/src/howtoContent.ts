export type HowToEntry = {
  title: string;
  icon?: string;
  sections?: { heading: string; bullets: string[] }[];
  bullets?: string[];
  hotkeys?: string[];
};

export const HOWTO: Record<string, HowToEntry> = {
  Home: {
    title: "Home — How to Use",
    sections: [
      {
        heading: "What it is",
        bullets: [
          "Your family front door.",
          "Use it to see what matters now, what to do next, and where to go."
        ]
      }
    ]
  },
  Homie: {
    title: "Homie — How to Use",
    sections: [
      {
        heading: "What it is",
        bullets: [
          "Your family guide and companion inside OddEngine.",
          "Ask plain-English questions and let Homie route you to the right panel."
        ]
      }
    ]
  },
  OddBrain: {
    title: "OddBrain — How to Use",
    sections: [
      {
        heading: "What it is",
        bullets: [
          "The shared truth layer for Home, Homie, and family/operator priorities.",
          "Use it to see what matters now and what lane needs attention."
        ]
      }
    ]
  },
  News: {
    title: "News — How to Use",
    sections: [
      {
        heading: "Best workflow",
        bullets: [
          "Refresh the lane, read the route note, then push the top story into the right panel.",
          "Use actionable-only thinking: family first, operator second."
        ]
      }
    ]
  },
  FamilyBudget: {
    title: "Family Budget — How to Use",
    sections: [
      {
        heading: "Best workflow",
        bullets: [
          "Start with the Family Clarity + Action block.",
          "Use it to see bills due soon, debt focus, and the next money move."
        ]
      }
    ]
  },
  FamilyHealth: {
    title: "Family Health — How to Use",
    sections: [
      {
        heading: "Best workflow",
        bullets: [
          "Use one tab per family member.",
          "Track symptoms, meds, next visit, and simple action notes."
        ]
      }
    ]
  },
  GroceryMeals: {
    title: "Grocery Meals — How to Use",
    sections: [
      {
        heading: "Best workflow",
        bullets: [
          "Update pantry, plan meals, then build the list.",
          "Use the savings lane and substitutions to stay on budget."
        ]
      }
    ]
  },
  Calendar: {
    title: "Calendar — How to Use",
    sections: [
      {
        heading: "Best workflow",
        bullets: [
          "Use quick-add buttons for family reminders and routines.",
          "Link events back into the right panel when the work lives somewhere else."
        ]
      }
    ]
  },
  DailyChores: {
    title: "Daily Chores — How to Use",
    sections: [
      {
        heading: "Best workflow",
        bullets: [
          "Start with the must-do queue.",
          "Clear the hot lane first, then move through house, outdoor, and animals."
        ]
      }
    ]
  },
  Entertainment: {
    title: "Family Entertainment — How to Use",
    sections: [
      {
        heading: "Best workflow",
        bullets: [
          "Use Family Night for one-click launch.",
          "Keep favorites clean and use quick queue for what should play next."
        ]
      }
    ]
  },
  Books: {
    title: "Writers Lounge — How to Use",
    sections: [
      {
        heading: "Best workflow",
        bullets: [
          "Start with one prompt and move through the finished-product path.",
          "Use Render Lab for the artifact handoff and release path."
        ]
      }
    ]
  },
  DevEngine: {
    title: "Dev Engine — How to Use",
    sections: [
      {
        heading: "Best workflow",
        bullets: [
          "Run build and repair tasks from inside the panel.",
          "Use it as the technical control lane for OddEngine."
        ]
      }
    ]
  },
  Plugins: {
    title: "Plugins — How to Use",
    sections: [
      {
        heading: "What it is",
        bullets: [
          "Installable feature packs and local plugin manifests.",
          "Use this lane to enable or repair optional OS upgrades."
        ]
      }
    ]
  },
  Preferences: {
    title: "Preferences — How to Use",
    sections: [
      {
        heading: "What it is",
        bullets: [
          "Local defaults and machine-specific settings.",
          "Use it to save the defaults that keep the OS comfortable on this device."
        ]
      }
    ]
  },
  Cannabis: {
    title: "Cannabis Hub",
    icon: "🍃",
    bullets: [
      "Discover searches near your ZIP in the browser.",
      "Deals lets you score and save pasted offers.",
      "Favorites and map help keep trusted places organized."
    ],
    hotkeys: ["F1 — How To"]
  },
  Trading: {
    title: "Trading — How to Use",
    sections: [
      {
        heading: "Current status",
        bullets: [
          "This lane is under surgical recovery during the runtime stability sweep.",
          "Use the stable chart/chain/watchlist areas first and avoid unfinished flows until the recovery pass lands."
        ]
      }
    ]
  }
};
