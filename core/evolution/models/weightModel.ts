
import { getStrategyStats } from "../strategyEvolution"

export function computeStrategyWeights(){

 const stats = getStrategyStats()

 return stats.map((s:any)=>{

   const score = (s.winRate*0.7) + (s.avgReturn*0.3)

   return {
     strategy:s.strategy,
     weight:score
   }

 })

}
