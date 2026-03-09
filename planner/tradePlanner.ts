
export interface Opportunity {
 ticker:string
 type:string
 probability:number
}

let plans:any[] = []

export function generateTradePlans(opps:Opportunity[]){

 plans = opps.map(o=>{

   let strategy = "Momentum Breakout"
   let strike = "+3% OTM Call"
   let expiry = "2 Weeks"

   if(o.type === "UNUSUAL_OPTIONS"){
     strategy = "Options Flow Follow"
   }

   if(o.type === "VOLATILITY_SPIKE"){
     strategy = "Volatility Expansion"
     strike = "ATM Straddle"
   }

   return {
     ticker:o.ticker,
     strategy:strategy,
     contract:strike,
     expiration:expiry,
     probability:o.probability
   }

 })

}

export function getTradePlans(){
 return plans
}
