
import { getTradeIdeas } from "../trade-engine/tradeEngine"
import { getPredictions } from "../neural/neuralStrategyEngine"
import { getMarketBrain } from "../market-brain/marketBrain"

let decisions:any[] = []

export function runInstitutionalBrain(){

 const ideas = getTradeIdeas()
 const predictions = getPredictions()
 const brain = getMarketBrain()

 decisions = ideas.map((idea:any)=>{

   const neural = predictions.find((p:any)=>p.ticker===idea.ticker)

   const probability = neural ? neural.probability : 0.5

   const regimeBoost = brain?.signals?.length ? 0.05 : 0

   const score = probability + regimeBoost

   return {
     ticker:idea.ticker,
     setup:idea.setup,
     probability:score,
     action: score>0.65 ? "BUY_CALLS" : "WATCH"
   }

 })

}

export function getInstitutionalDecisions(){

 return decisions

}
