
import { getSimulationHistory } from "../tradeSimulator"

export function computePerformance(){

 const history = getSimulationHistory()

 let wins = 0
 let total = history.length
 let totalReturn = 0

 history.forEach((h:any)=>{
  if(h.win) wins++
  totalReturn += h.returnPct
 })

 return {
  trades: total,
  winRate: total ? wins/total : 0,
  avgReturn: total ? totalReturn/total : 0
 }

}
