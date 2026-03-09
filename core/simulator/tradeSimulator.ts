
import { getTradeIdeas } from "../trade-engine/tradeEngine"

const history:any[] = []

export function simulateTrades(){

 const ideas = getTradeIdeas()

 ideas.forEach((idea:any)=>{

   const win = Math.random() > 0.4
   const returnPct = win ? (Math.random()*1.2) : -(Math.random()*0.5)

   history.unshift({
     ticker:idea.ticker,
     setup:idea.setup,
     win,
     returnPct,
     time:Date.now()
   })

 })

}

export function getSimulationHistory(){

 return history.slice(0,50)

}
