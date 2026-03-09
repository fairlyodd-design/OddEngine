
import { runTradeEngine } from "./tradeEngine"

export function startTradeEngine(){

 setInterval(async ()=>{

   try{
     await runTradeEngine()
   }catch(e){
     console.error("Trade engine error",e)
   }

 },20000)

}
