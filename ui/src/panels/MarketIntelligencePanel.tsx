
import React,{useEffect,useState} from "react"
import { getMarketNodes } from "../../../marketBrain/engines/marketGraph"
import { getSectorFlow } from "../../../marketBrain/engines/sectorFlow"
import { getSignals } from "../../../marketBrain/engines/signalOverlay"

export default function MarketIntelligencePanel(){

 const [nodes,setNodes] = useState<any[]>([])
 const [flows,setFlows] = useState<any[]>([])
 const [signals,setSignals] = useState<any[]>([])

 useEffect(()=>{

   const i = setInterval(()=>{

     setNodes(getMarketNodes())
     setFlows(getSectorFlow())
     setSignals(getSignals())

   },3000)

   return ()=>clearInterval(i)

 },[])

 return (

   <div className="panel">

     <div className="h">Market Intelligence Map</div>

     <div style={{marginTop:10}}>

       <div><b>Sectors</b></div>
       {flows.map((f,i)=>(
         <div key={i}>{f.sector} Flow {f.flow}%</div>
       ))}

       <div style={{marginTop:10}}><b>Tickers</b></div>
       {nodes.map((n,i)=>(
         <div key={i}>{n.ticker} ({n.sector})</div>
       ))}

       <div style={{marginTop:10}}><b>AI Signals</b></div>
       {signals.map((s,i)=>(
         <div key={i}>{s.ticker} → {s.signal}</div>
       ))}

     </div>

   </div>

 )

}
