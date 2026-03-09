
import React,{useEffect,useState} from "react"
import { rankSignals,getTopOpportunities } from "../../../ranking/opportunityRanker"
import { buildOpportunity } from "../../../ranking/models/opportunityModel"

export default function OpportunityRadarPanel(){

 const [ops,setOps] = useState<any[]>([])

 useEffect(()=>{

   const i = setInterval(()=>{

     const sampleSignals = [
       {type:"UNUSUAL_OPTIONS",ticker:"NVDA"},
       {type:"MOMENTUM_SETUP",ticker:"WBD",strength:0.7},
       {type:"SECTOR_BREAKOUT",sector:"TECH"},
       {type:"VOLATILITY_SPIKE",ticker:"VIX"}
     ]

     rankSignals(sampleSignals)

     const ranked = getTopOpportunities().map(o=>buildOpportunity(o))

     setOps(ranked)

   },3000)

   return ()=>clearInterval(i)

 },[])

 return (

   <div className="panel">

     <div className="h">Opportunity Radar</div>

     {ops.map((o,i)=>(
       <div key={i}>
         {o.ticker} — {o.type} — {o.probability}
       </div>
     ))}

   </div>

 )

}
