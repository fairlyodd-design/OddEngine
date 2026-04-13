// DROP-IN PATCH FOR Books.tsx
import { safeRender } from "../lib/safeRender";

// Replace ANY risky render usage like:
// {item}
// {`${item}`}
// array.map(x => <div>{x}</div>)

// WITH:

// Example safe usage:

// array.map(x => <div>{safeRender(x)}</div>)

// subtitle fix example:

// subtitle={safeRender(item)}

// Specific better mapping (recommended):
// subtitle={item?.shotId || item?.sceneId || safeRender(item)}
