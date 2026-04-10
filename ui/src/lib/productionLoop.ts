
import { createPublisherJob } from "./publisherEngine";

export type AutoLoopMode = "manual" | "assisted" | "full-auto";
export function queueAutoProductionLoop(input: { handoff: any; mode?: AutoLoopMode; autoPublish?: boolean }) {
  const handoff = input.handoff || {};
  const targets = handoff?.distribution?.targets || handoff?.distribution?.publishTargets || ['local'];
  return createPublisherJob({
    sourceId: handoff.projectId || handoff.id || '',
    sourceTitle: handoff.title || 'Untitled studio handoff',
    contentType: handoff.type || 'asset',
    targets,
    autoPublish: !!input.autoPublish || input.mode === 'full-auto',
    payload: { handoff, mode: input.mode || 'assisted' },
  });
}
