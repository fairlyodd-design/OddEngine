
import { getSignals } from "./signalBus"

export function correlateSignals(){

 const signals = getSignals()

 const clusters:any[] = []

 signals.forEach(s=>{

   if(s.type === "options-flow"){
      clusters.push({
        type:"momentum",
        ticker:s.ticker,
        strength:s.strength || 0.5
      })
   }

 })

 return clusters

}
