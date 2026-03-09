
export function classifyFlow(flow:any){

 if(flow.type === "CALL_SWEEP" && parseFloat(flow.size) > 3){

   return {
     signal:"BULLISH_FLOW",
     confidence:0.7 + Math.random()*0.2
   }

 }

 if(flow.type === "PUT_SWEEP" && parseFloat(flow.size) > 3){

   return {
     signal:"BEARISH_FLOW",
     confidence:0.7 + Math.random()*0.2
   }

 }

 return {
   signal:"NEUTRAL",
   confidence:0.5
 }

}
