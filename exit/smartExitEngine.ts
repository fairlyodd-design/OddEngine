
import { takeProfit, stopLoss, trailingStop } from "./strategies/exitStrategies"

export function evaluateExit(position:any){

 const rules = [
   takeProfit(position),
   stopLoss(position),
   trailingStop(position)
 ]

 for(const r of rules){
   if(r){
     return r
   }
 }

 return {action:"HOLD"}
}
