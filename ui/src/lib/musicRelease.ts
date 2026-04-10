import { loadJSON, saveJSON } from './storage';
import { createPublisherJob } from './publisherEngine';

export type MusicReleaseAsset = {
  folder: string;
  title: string;
  files: string[];
  metadata?: any;
  latest?: any;
  createdAt: number;
};

const KEY = 'oddengine:musiclab:latestRelease:v1';

export function saveLatestMusicRelease(asset: MusicReleaseAsset) {
  saveJSON(KEY, asset);
  return asset;
}

export function getLatestMusicRelease(): MusicReleaseAsset | null {
  return loadJSON<MusicReleaseAsset | null>(KEY, null);
}

export function createPublisherJobFromMusicRelease(asset: MusicReleaseAsset, targets: string[] = ['local', 'youtube', 'gumroad']) {
  return createPublisherJob({
    sourceId: asset.folder,
    sourceTitle: asset.title || 'Untitled release',
    contentType: 'music-release',
    targets,
    autoPublish: true,
    payload: {
      kind: 'music-release',
      release: asset,
    },
  });
}

export function musicReleaseDragPayload(asset: MusicReleaseAsset) {
  return JSON.stringify({
    kind: 'oddengine/music-release',
    release: asset,
  });
}
