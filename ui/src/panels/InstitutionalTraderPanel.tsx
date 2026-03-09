
import React,{useEffect,useState} from "react"
import { runInstitutionalBrain,getInstitutionalDecisions } from "../../../core/institutional-ai/institutionalBrain"
import { buildTradeTicket } from "../../../core/institutional-ai/models/tradeTicketModel"

export default function InstitutionalTraderPanel(){

 const [tickets,setTickets] = useState<any[]>([])

 useEffect(()=>{

  const i = setInterval(()=>{

    runInstitutionalBrain()

    const decisions = getInstitutionalDecisions()

    setTickets(decisions.map(d=>buildTradeTicket(d)))

  },4000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Institutional AI Trader</div>

   {tickets.map((t,i)=>(

     <div key={i} style={{marginBottom:12}}>

       <b>{t.ticker}</b>

       <div>
        Strategy: {t.strategy}
       </div>

       <div>
        Contract: {t.contract}
       </div>

       <div>
        Probability: {(t.probability*100).toFixed(0)}%
       </div>

       <div>
        Size: {t.size} contract
       </div>

     </div>

   ))}

  </div>

 )

}
