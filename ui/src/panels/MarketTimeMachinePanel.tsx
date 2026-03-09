
import React,{useEffect,useState} from "react"
import { getMarketForecast } from "../../../timeMachine/engines/forecastEngine"
import { simulateFutureCapital } from "../../../timeMachine/engines/futureFlows"
import { generateSimulation } from "../../../timeMachine/models/simulationModel"

export default function MarketTimeMachinePanel(){

 const [forecast,setForecast] = useState<any[]>([])
 const [flows,setFlows] = useState<any[]>([])
 const [simulation,setSimulation] = useState<any>({})

 useEffect(()=>{

   const i=setInterval(()=>{

     setForecast(getMarketForecast())
     setFlows(simulateFutureCapital())
     setSimulation(generateSimulation())

   },4000)

   return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">AI Market Time Machine</div>

   <div style={{marginTop:10}}>

    <div><b>Sector Forecast</b></div>
    {forecast.map((f,i)=>(
     <div key={i}>
      {f.sector} → {f.direction} ({Math.round(f.probability*100)}%) horizon {f.horizon}
     </div>
    ))}

    <div style={{marginTop:10}}><b>Future Capital Flows</b></div>
    {flows.map((f,i)=>(
     <div key={i}>
      {f.from} → {f.to} strength {f.strength} {f.time}
     </div>
    ))}

    <div style={{marginTop:10}}><b>AI Simulation</b></div>
    <div>{simulation.description}</div>
    <div>Confidence {Math.round((simulation.confidence||0)*100)}%</div>

   </div>

  </div>

 )

}
