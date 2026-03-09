
export function formatTradePlan(plan:any){

 return {
   ticker:plan.ticker,
   strategy:plan.strategy,
   contract:plan.contract,
   expiration:plan.expiration,
   probability:(plan.probability*100).toFixed(0)+"%"
 }

}
