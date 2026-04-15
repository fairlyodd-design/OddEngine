import { loadJSON, saveJSON } from "./storage";

export type Notif = {
  id: string;
  ts: number;
  title: string;
  body?: string;
  tags: string[];
  level: "info" | "warn" | "error" | "success";
};

const KEY = "oddengine:notifs";

export function getNotifs(): Notif[] {
  return loadJSON<Notif[]>(KEY, []);
}

export function pushNotif(n: Omit<Notif,"id"|"ts">){
  const list = getNotifs();
  const notif: Notif = { id: crypto.randomUUID(), ts: Date.now(), ...n };
  list.unshift(notif);
  saveJSON(KEY, list.slice(0, 500));
  return notif;
}

export function clearNotifs(){
  saveJSON(KEY, []);
}
