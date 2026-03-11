import fs from "node:fs";

const file = "ui/src/lib/brain.ts";
let s = fs.readFileSync(file, "utf8");

function replaceOnce(search, replacement, label) {
  if (!s.includes(search)) {
    throw new Error(`Could not find marker for: ${label}`);
  }
  s = s.replace(search, replacement);
}

replaceOnce(
  `{ id:"Books", icon:"??", title:"Writers Lounge", sub:"Books vault + AI writing assistant", section:"CORE PANELS", assistantName:"Homie (Writer)", assistantRole:"Creative co-writer + ship coach", description:"A creator studio for your books: chapters, drafts, notes, plus an embedded AI writing assistant (local-first).", quickPrompts:["Start a new book idea.","Outline my next chapter (3 options).","Write the next scene with a strong hook."], storageKeys:["oddengine:books:v1","oddengine:writers:chat:v1"], nextSteps:["Schedule 30-min writing blocks in Calendar.","Keep chapters short and punchy.","Use AI to generate options, then pick the best and polish."], quickActionIds:["books:add","books:copy-active"], actions:[{ id:"homie", label:"Open Homie", kind:"navigate", panelId:"Homie" },{ id:"calendar", label:"Open Calendar", kind:"navigate", panelId:"Calendar" }] },`,
  `{ id:"Books", icon:"??", title:"Studio", sub:"AI creation pipeline + working copies", section:"CORE PANELS", assistantName:"Homie (Studio)", assistantRole:"Prompt-to-project creative operator", description:"FairlyOdd Studio inside the larger FairlyOdd OS: one prompt into songs, books, cartoons, videos, render jobs, and producer-ready working packets.", quickPrompts:["Start a new studio project from one prompt.","Turn this idea into a finished creative pipeline.","Build writing, director, music, and render lanes for this concept."], storageKeys:["oddengine:books:v1","oddengine:writers:chat:v1"], nextSteps:["Start from one master prompt.","Let the AI build writing, director, music, and render lanes.","Use Producer Ops to package the final working copy."], quickActionIds:["books:add","books:copy-active"], actions:[{ id:"homie", label:"Open Homie", kind:"navigate", panelId:"Homie" },{ id:"calendar", label:"Open Calendar", kind:"navigate", panelId:"Calendar" }] },`,
  "Books panel meta"
);

replaceOnce(
  `{ id: "books:add", label: "Add book", panelId: "Books", description: "Create a new book entry in Books Vault." },`,
  `{ id: "books:add", label: "New Studio Project", panelId: "Books", description: "Create a new Studio project entry." },`,
  "books:add quick action"
);

replaceOnce(
  `{ id: "books:copy-active", label: "Copy active book", panelId: "Books", description: "Copy the active book JSON to clipboard." },`,
  `{ id: "books:copy-active", label: "Copy active project", panelId: "Books", description: "Copy the active Studio project JSON to clipboard." },`,
  "books:copy-active quick action"
);

replaceOnce(
  `title: "Untitled Book",`,
  `title: "Untitled Studio Project",`,
  "default title"
);

replaceOnce(
  `return { ok: true, message: "Added a new book.", panelId: "Books" };`,
  `return { ok: true, message: "Added a new Studio project.", panelId: "Books" };`,
  "add success"
);

replaceOnce(
  `if (!active) return { ok: false, message: "No books found to copy.", panelId: "Books" };`,
  `if (!active) return { ok: false, message: "No Studio projects found to copy.", panelId: "Books" };`,
  "copy missing"
);

replaceOnce(
  `return { ok: true, message: "Copied active book JSON.", panelId: "Books" };`,
  `return { ok: true, message: "Copied active Studio project JSON.", panelId: "Books" };`,
  "copy success"
);

fs.writeFileSync(file, s);
console.log("Patched ui/src/lib/brain.ts for v10.24.65_OSNavLabelCleanupPass");
