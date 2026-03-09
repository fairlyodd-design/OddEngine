
import { getTradeIdeas } from "../trade-engine/tradeEngine"

const scored:any[] = []

export function scoreTradeIdeas(){

 const ideas = getTradeIdeas()

 ideas.forEach((idea:any)=>{

   const probability = 0.55 + Math.random()*0.25
   const rr = 1 + Math.random()*2

   scored.unshift({
     ...idea,
     probability,
     riskReward:rr,
     expectedMove:(Math.random()*3).toFixed(2)+"%"
   })

 })

}

export function getScoredTrades(){

 return scored.slice(0,10)

}
