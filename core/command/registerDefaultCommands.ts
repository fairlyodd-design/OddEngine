
import { registerCommand } from "./commandRegistry"

export function registerDefaultCommands(){

 registerCommand({
  id:"open.trading",
  title:"Open Trading Workspace",
  action:()=>console.log("Trading workspace opened")
 })

 registerCommand({
  id:"open.grow",
  title:"Open Grow Dashboard",
  action:()=>console.log("Grow dashboard opened")
 })

 registerCommand({
  id:"scan.nvda",
  title:"Scan NVDA Options",
  action:()=>console.log("Scanning NVDA options")
 })

}
