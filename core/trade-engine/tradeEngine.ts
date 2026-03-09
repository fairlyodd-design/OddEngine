
import { getSignals } from "../intelligence/signalBus"
import { getInsights } from "../intelligence/insightEngine"
import { fetchMarketSnapshot } from "../operator/providers/marketProvider"

const ideas:any[] = []

export async function runTradeEngine(){

 const signals = getSignals()
 const insights = getInsights()
 const market = await fetchMarketSnapshot()

 analyze(signals, insights, market)

}

function analyze(signals:any[], insights:any[], market:any){

 const nvdaSignal = signals.find((s:any)=>s.ticker==="NVDA")

 if(nvdaSignal){

   ideas.unshift({
     ticker:"NVDA",
     setup:"Momentum continuation",
     contract:"Next expiry call 3‑5% OTM",
     confidence:0.78,
     time:Date.now()
   })

 }

}

export function getTradeIdeas(){

 return ideas.slice(0,10)

}
