
import { runCommand } from "../command/commandBus"
import { parseTradingCommand } from "./parsers/tradingParser"

export async function runAICommand(input:string){

 const lower = input.toLowerCase()

 const trading = parseTradingCommand(lower)
 if(trading){
  runCommand(trading)
  return
 }

 if(lower.includes("open trading")){
  runCommand("open.trading")
  return
 }

 if(lower.includes("open grow")){
  runCommand("open.grow")
  return
 }

 console.log("AI command not recognized:",input)

}
