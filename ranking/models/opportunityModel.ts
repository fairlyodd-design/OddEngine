
export function buildOpportunity(signal:any){

 return {
   ticker: signal.ticker || signal.sector,
   type: signal.type,
   probability: (signal.score * 100).toFixed(0) + "%"
 }

}
