
import { registerAgent } from "../kernel/runtime/agentRuntime"
import { emit } from "../kernel/eventBus"

registerAgent("tradeAgent",(on:any)=>{

 on("ORDERFLOW_SIGNAL",(data:any)=>{

   if(data.signal === "BULLISH_FLOW"){

     emit("TRADE_SIGNAL",{
       ticker:data.ticker,
       strategy:"momentum_breakout"
     })

   }

 })

})
