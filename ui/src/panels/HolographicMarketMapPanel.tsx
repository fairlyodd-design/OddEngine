
import React,{useEffect,useState} from "react"
import { getUniverseNodes } from "../../../holographicMap/engines/universeNodes"
import { getMoneyStreams } from "../../../holographicMap/engines/moneyStreams"
import { getAIPulses } from "../../../holographicMap/engines/aiPulse"

export default function HolographicMarketMapPanel(){

 const [nodes,setNodes] = useState<any[]>([])
 const [streams,setStreams] = useState<any[]>([])
 const [signals,setSignals] = useState<any[]>([])

 useEffect(()=>{

   const i = setInterval(()=>{

    setNodes(getUniverseNodes())
    setStreams(getMoneyStreams())
    setSignals(getAIPulses())

   },3000)

   return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Holographic Market Map</div>

   <div style={{marginTop:10}}>

    <div><b>Market Universe</b></div>
    {nodes.map((n,i)=>(
     <div key={i}>{n.ticker} [{n.sector}] energy {n.energy}</div>
    ))}

    <div style={{marginTop:10}}><b>Money Streams</b></div>
    {streams.map((s,i)=>(
     <div key={i}>{s.from} → {s.to} ({s.strength})</div>
    ))}

    <div style={{marginTop:10}}><b>AI Pulses</b></div>
    {signals.map((s,i)=>(
     <div key={i}>{s.ticker} → {s.signal}</div>
    ))}

   </div>

  </div>

 )

}
