
export type PublishTarget = "youtube" | "gumroad" | "kdp" | "tiktok";

export type PublishJob = {
  id: string;
  title: string;
  description: string;
  target: PublishTarget;
  status: "idle" | "uploading" | "published" | "failed";
  url?: string;
};

export function createPublishJob(title: string, description: string, target: PublishTarget): PublishJob {
  return {
    id: Date.now().toString(),
    title,
    description,
    target,
    status: "idle",
  };
}

export function simulatePublish(job: PublishJob): PublishJob {
  return {
    ...job,
    status: "published",
    url: `https://${job.target}.com/mock/${job.id}`
  };
}
