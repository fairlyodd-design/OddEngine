
import { getSimulationHistory } from "../simulator/tradeSimulator"

const strategyStats:any = {}

export function evolveStrategies(){

 const history = getSimulationHistory()

 history.forEach((h:any)=>{

   const key = h.setup || "unknown"

   if(!strategyStats[key]){
     strategyStats[key] = {
       trades:0,
       wins:0,
       totalReturn:0
     }
   }

   strategyStats[key].trades++

   if(h.win) strategyStats[key].wins++

   strategyStats[key].totalReturn += h.returnPct

 })

}

export function getStrategyStats(){

 const result:any[] = []

 Object.keys(strategyStats).forEach((k)=>{

   const s = strategyStats[k]

   result.push({
     strategy:k,
     trades:s.trades,
     winRate: s.trades ? s.wins/s.trades : 0,
     avgReturn: s.trades ? s.totalReturn/s.trades : 0
   })

 })

 return result

}
