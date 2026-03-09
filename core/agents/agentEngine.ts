
import { getAgents } from "./agentRegistry"

export function startAgents(){

 const agents = getAgents()

 setInterval(async () => {

   for(const agent of agents){

      try{
        await agent.run()
      }catch(err){
        console.error("Agent error:",agent.name,err)
      }

   }

 },30000)

}
