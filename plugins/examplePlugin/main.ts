
import { emit } from "../../kernel/eventBus"

export function runExamplePlugin(){

 emit("ORDERFLOW_SIGNAL",{
   ticker:"SPY",
   signal:"BULLISH_FLOW"
 })

}
