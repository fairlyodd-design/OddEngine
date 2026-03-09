
import { riskLimits } from "./limits/riskLimits"

export function evaluateTrade(accountValue:number, portfolioRisk:number){

 if(portfolioRisk > riskLimits.maxPortfolioRisk){
   return {approved:false, reason:"Portfolio risk limit exceeded"}
 }

 if(accountValue <= 0){
   return {approved:false, reason:"Account balance invalid"}
 }

 return {approved:true}
}
