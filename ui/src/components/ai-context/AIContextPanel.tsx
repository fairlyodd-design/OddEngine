
import React, { useEffect, useState } from "react"
import { buildAIContext } from "../../../../core/ai-context/contextEngine"

export default function AIContextPanel(){

 const [ctx,setCtx] = useState<any>(null)

 useEffect(()=>{

  async function load(){

   const c = await buildAIContext()

   setCtx(c)

  }

  load()

 },[])

 if(!ctx) return <div>Loading AI context...</div>

 return (

  <div className="aiContextPanel">

   <div className="h">AI System Context</div>

   <div>

    <b>Watchlist</b>

    {ctx.trading.watchlist.map((s:any)=>(
      <div key={s}>{s}</div>
    ))}

   </div>

   <div>

    <b>Recent Activity</b>

    {ctx.activity.map((a:any,i:number)=>(
      <div key={i}>{a.message}</div>
    ))}

   </div>

  </div>

 )

}
