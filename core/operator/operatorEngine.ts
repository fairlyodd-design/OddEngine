
import { getSignals } from "../intelligence/signalBus"
import { getInsights } from "../intelligence/insightEngine"
import { fetchMarketSnapshot } from "./providers/marketProvider"

export async function runOperatorQuery(query:string){

 const signals = getSignals()
 const insights = getInsights()
 const market = await fetchMarketSnapshot()

 const context = {
  query,
  signals,
  insights,
  market
 }

 return analyzeContext(context)

}

function analyzeContext(ctx:any){

 const nvdaSignal = ctx.signals.find((s:any)=>s.ticker==="NVDA")

 if(nvdaSignal){

   return {
     answer:"NVDA showing momentum signals. Possible continuation setup.",
     confidence:0.72
   }

 }

 return {
   answer:"No strong setups detected yet.",
   confidence:0.35
 }

}
