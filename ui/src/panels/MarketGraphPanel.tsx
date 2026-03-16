
import React,{useEffect,useState} from "react"
import { getMarketGraph } from "../../../core/market-graph/marketGraph"
import { detectMoneyFlow } from "../../../core/market-graph/models/moneyFlowModel"
import { updateSectorRotation,getSectorLeaders,getSectorState } from "../../../core/sector-rotation/sectorRotationAI"

export default function MarketGraphPanel(){

 const [flows,setFlows] = useState<any[]>([])
 const [leaders,setLeaders] = useState<any[]>([])
 const [sectors,setSectors] = useState<any[]>([])

 useEffect(()=>{

  const graph = getMarketGraph()

  const i = setInterval(()=>{

    updateSectorRotation()

    setFlows(detectMoneyFlow(graph.edges))

    setLeaders(getSectorLeaders())

    setSectors(getSectorState())

  },4000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Global Market Graph</div>

   <div>
     <b>Money Flow</b>

     {flows.map((f,i)=>(
       <div key={i}>
        {f.path} : strength {f.strength}
       </div>
     ))}

   </div>

   <div style={{marginTop:12}}>

     <b>Sector Leaders</b>

     {leaders.map((s,i)=>(
       <div key={i}>
        {s.sector} momentum {s.momentum}
       </div>
     ))}

   </div>

   <div style={{marginTop:12}}>

     <b>Sector Map</b>

     {sectors.map((s,i)=>(
       <div key={i}>
        {s.sector} inflow {s.inflow}
       </div>
     ))}

   </div>

  </div>

 )

}
