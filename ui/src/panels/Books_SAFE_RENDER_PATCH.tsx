// Apply these patterns inside Books.tsx anywhere object-like values are rendered directly.

import { safeRender, safeSubtitle } from "../lib/safeRender";
import { pickDisplayFields } from "../lib/renderGuards";

// 1) BAD:
// {item}
// {`${item}`}
// subtitle={`${item}`}
// list.map((x) => <div>{x}</div>)

// 2) GOOD:
{/* {safeRender(item)} */}
{/* subtitle={safeSubtitle(item)} */}
{/* list.map((x, i) => <div key={i}>{safeRender(x)}</div>) */}

// 3) For cards fed by structured objects:
const display = pickDisplayFields(item);
// <StageCard title={display.title} subtitle={display.subtitle} ... />

// 4) For error/debug panes:
function ObjectDebug({ value }: { value: unknown }) {
  return (
    <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {safeRender(value)}
    </pre>
  );
}

// 5) Replace risky recent/action/notes pills:
{/* recentItems.map((item, i) => (
  <button key={i}>{safeRender(item)}</button>
)) */}
