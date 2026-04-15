// Apply the same object-safe rendering patterns inside Builder.tsx.

import { safeRender, safeSubtitle } from "../lib/safeRender";
import { pickDisplayFields } from "../lib/renderGuards";

// Any thumbnail rail / artifact tiles / timeline rows that currently do:
// {entry}
// {`${entry}`}
// subtitle={`${artifact}`}
// should use safeRender(...) or pickDisplayFields(entry) instead.
