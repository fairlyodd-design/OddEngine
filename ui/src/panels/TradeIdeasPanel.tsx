
import React,{useEffect,useState} from "react"
import { getTradeIdeas } from "../../../core/trade-engine/tradeEngine"

export default function TradeIdeasPanel(){

 const [ideas,setIdeas] = useState<any[]>([])

 useEffect(()=>{

  const i = setInterval(()=>{

    setIdeas(getTradeIdeas())

  },3000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Autonomous Trade Ideas</div>

   {ideas.map((idea,i)=>(

     <div key={i} style={{marginBottom:10}}>

       <b>{idea.ticker}</b> — {idea.setup}

       <div>{idea.contract}</div>

       <div>
        Confidence: {(idea.confidence*100).toFixed(0)}%
       </div>

     </div>

   ))}

  </div>

 )

}
