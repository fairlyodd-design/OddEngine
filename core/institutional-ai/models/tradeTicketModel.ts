
export function buildTradeTicket(decision:any){

 return {
   ticker: decision.ticker,
   strategy: decision.setup,
   contract: "+3% OTM Call",
   size: 1,
   probability: decision.probability
 }

}
