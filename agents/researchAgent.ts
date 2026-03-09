
import { pushAgentAlert } from "../core/agents/agentBus"

export const ResearchAgent = {

 name:"Research Agent",

 async run(){

   const newsTrend = Math.random() > 0.99

   if(newsTrend){

      pushAgentAlert({
        type:"research",
        message:"AI sector trending on news sentiment"
      })

   }

 }
}
