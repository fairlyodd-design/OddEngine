
import React, { useEffect, useState } from "react"
import { fetchInsights } from "../../../core/intelligence/insightStore"
import { generateInsights } from "../../../core/intelligence/insightEngine"

export default function InsightsPanel(){

 const [insights,setInsights] = useState<any[]>([])

 useEffect(()=>{

  const i = setInterval(()=>{

    generateInsights()

    setInsights(fetchInsights())

  },5000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">AI Insights</div>

   {insights.map((i,idx)=>(
     <div key={idx}>
       {i.message}
     </div>
   ))}

  </div>

 )
}
