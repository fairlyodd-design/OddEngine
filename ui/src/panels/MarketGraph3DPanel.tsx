
import React,{useEffect,useState} from "react"
import { getNodes } from "../../../marketGraph3D/engines/graphNodes"
import { getEdges } from "../../../marketGraph3D/engines/graphEdges"
import { getSignalPulses } from "../../../marketGraph3D/engines/signalPulse"

export default function MarketGraph3DPanel(){

 const [nodes,setNodes] = useState<any[]>([])
 const [edges,setEdges] = useState<any[]>([])
 const [signals,setSignals] = useState<any[]>([])

 useEffect(()=>{

   const i = setInterval(()=>{

     setNodes(getNodes())
     setEdges(getEdges())
     setSignals(getSignalPulses())

   },3000)

   return ()=>clearInterval(i)

 },[])

 return (

   <div className="panel">

     <div className="h">3D Market Graph</div>

     <div style={{marginTop:10}}>

       <div><b>Nodes</b></div>
       {nodes.map((n,i)=>(
        <div key={i}>{n.ticker} [{n.sector}]</div>
       ))}

       <div style={{marginTop:10}}><b>Connections</b></div>
       {edges.map((e,i)=>(
        <div key={i}>{e.a} ↔ {e.b}</div>
       ))}

       <div style={{marginTop:10}}><b>Signals</b></div>
       {signals.map((s,i)=>(
        <div key={i}>{s.ticker} → {s.signal}</div>
       ))}

     </div>

   </div>

 )

}
