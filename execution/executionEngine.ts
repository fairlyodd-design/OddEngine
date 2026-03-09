
import { approveTrade } from "./risk/riskGuardian"
import { sendPaperOrder } from "./brokers/paperBroker"

export function executeTrade(plan:any, account:number){

 const riskCheck = approveTrade(account,0.02)

 if(!riskCheck.approved){
   return {
     success:false,
     reason:riskCheck.reason
   }
 }

 const order = {
   ticker:plan.ticker,
   strategy:plan.strategy,
   contract:plan.contract,
   size:plan.size
 }

 return sendPaperOrder(order)

}
