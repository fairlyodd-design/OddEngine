
import { pushAgentAlert } from "../core/agents/agentBus"

export const GrowAgent = {

 name:"Grow Agent",

 async run(){

   const humidity = 60 + Math.random()*15

   if(humidity > 70){

      pushAgentAlert({
        type:"grow",
        message:"Humidity drifting above target"
      })

   }

 }

}
