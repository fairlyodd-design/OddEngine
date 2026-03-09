
import React,{useEffect,useState} from "react"
import { getCapitalFlows } from "../../../capitalFlow/engines/capitalFlowEngine"
import { getSectorStrength } from "../../../capitalFlow/engines/sectorStrength"
import { getMoneyVelocity } from "../../../capitalFlow/engines/moneyVelocity"

export default function CapitalFlowPanel(){

 const [flows,setFlows] = useState<any[]>([])
 const [strength,setStrength] = useState<any[]>([])
 const [velocity,setVelocity] = useState<any[]>([])

 useEffect(()=>{

  const i = setInterval(()=>{

   setFlows(getCapitalFlows())
   setStrength(getSectorStrength())
   setVelocity(getMoneyVelocity())

  },3000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Capital Flow Engine</div>

   <div style={{marginTop:10}}>

    <div><b>Sector Strength</b></div>
    {strength.map((s,i)=>(
      <div key={i}>{s.sector}: {s.strength}</div>
    ))}

    <div style={{marginTop:10}}><b>Capital Rotation</b></div>
    {flows.map((f,i)=>(
      <div key={i}>{f.source} → {f.target} ({f.strength})</div>
    ))}

    <div style={{marginTop:10}}><b>Money Velocity</b></div>
    {velocity.map((v,i)=>(
      <div key={i}>{v.ticker}: {v.velocity}</div>
    ))}

   </div>

  </div>

 )

}
