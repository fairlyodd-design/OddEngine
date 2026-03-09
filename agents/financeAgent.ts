
import { pushAgentAlert } from "../core/agents/agentBus"

export const FinanceAgent = {

 name:"Finance Agent",

 async run(){

   const spendingSpike = Math.random() > 0.97

   if(spendingSpike){

      pushAgentAlert({
        type:"finance",
        message:"Subscription expenses increased this week"
      })

   }

 }

}
