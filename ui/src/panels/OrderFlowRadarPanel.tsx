
import React,{useEffect,useState} from "react"
import { scanOrderFlow,getOrderFlow } from "../../../core/orderflow/orderFlowScanner"
import { scanDarkPools,getDarkPoolPrints } from "../../../core/darkpool/darkPoolRadar"
import { classifyFlow } from "../../../core/orderflow/models/flowSignalModel"

export default function OrderFlowRadarPanel(){

 const [flows,setFlows] = useState<any[]>([])
 const [prints,setPrints] = useState<any[]>([])

 useEffect(()=>{

  const i = setInterval(()=>{

    scanOrderFlow()
    scanDarkPools()

    const f = getOrderFlow().map(flow=>{
      const sig = classifyFlow(flow)
      return {...flow, signal:sig.signal, confidence:sig.confidence}
    })

    setFlows(f)
    setPrints(getDarkPoolPrints())

  },3000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Order Flow + Dark Pool Radar</div>

   <div>
     <b>Options Flow</b>

     {flows.map((f,i)=>(
       <div key={i}>
        {f.ticker} {f.type} ${f.size} → {f.signal}
       </div>
     ))}

   </div>

   <div style={{marginTop:12}}>

     <b>Dark Pool Prints</b>

     {prints.map((p,i)=>(
       <div key={i}>
        {p.ticker} ${p.price} size {p.size}
       </div>
     ))}

   </div>

  </div>

 )

}
