
export interface Signal {
 type:string
 ticker?:string
 sector?:string
 strength?:number
 size?:string
}

let opportunities:any[] = []

export function rankSignals(signals:Signal[]){

 opportunities = signals.map(s=>{

   let score = 0

   if(s.type === "UNUSUAL_OPTIONS") score += 0.4
   if(s.type === "MOMENTUM_SETUP") score += 0.3
   if(s.type === "SECTOR_BREAKOUT") score += 0.2
   if(s.type === "VOLATILITY_SPIKE") score += 0.1

   if(s.strength) score += parseFloat(String(s.strength)) * 0.2

   return {
     ...s,
     score:score
   }

 }).sort((a,b)=>b.score-a.score)

}

export function getTopOpportunities(){
 return opportunities.slice(0,10)
}
