
import { computeCorrelations } from "./correlationEngine"

let state:any = {}

export function updateMarketBrain(){

 const correlations = computeCorrelations(null)

 const vixSpike = Math.random() > 0.7

 state = {
  correlations,
  signals:[
   vixSpike ? "VIX spike detected" : null,
   Math.random()>0.6 ? "Momentum building in tech" : null
  ].filter(Boolean)
 }

}

export function getMarketBrain(){

 return state

}
