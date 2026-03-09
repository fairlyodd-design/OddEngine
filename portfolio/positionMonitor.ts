
import { evaluateExit } from "../exit/smartExitEngine"

export function monitorPosition(position:any){

 const decision = evaluateExit(position)

 return {
   ticker: position.ticker,
   action: decision.action,
   reason: decision.reason || "Monitoring"
 }

}
