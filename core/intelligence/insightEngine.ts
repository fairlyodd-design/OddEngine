
import { correlateSignals } from "./correlationEngine"

const insights:any[] = []

export function generateInsights(){

 const clusters = correlateSignals()

 clusters.forEach(c=>{

   const insight = {
     ticker:c.ticker,
     message:`Momentum signals forming on ${c.ticker}`,
     strength:c.strength,
     time:Date.now()
   }

   insights.unshift(insight)

 })

}

export function getInsights(){

 return insights.slice(0,20)

}
