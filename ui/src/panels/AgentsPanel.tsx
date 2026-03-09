
import React, { useEffect, useState } from "react"
import { getAgentAlerts } from "../../../core/agents/agentBus"

export default function AgentsPanel(){

 const [alerts,setAlerts] = useState<any[]>([])

 useEffect(()=>{

  const i = setInterval(()=>{

    setAlerts(getAgentAlerts())

  },2000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Autonomous Agents</div>

   <div style={{marginBottom:10}}>

    Active Agents:

    <div>Trade Agent</div>
    <div>Grow Agent</div>
    <div>Finance Agent</div>
    <div>Research Agent</div>

   </div>

   <div>

    <b>Recent Alerts</b>

    {alerts.map((a,i)=>(
      <div key={i}>
        {a.message}
      </div>
    ))}

   </div>

  </div>

 )

}
