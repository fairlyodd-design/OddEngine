
import React,{useEffect,useState} from "react"
import { scoreTradeIdeas,getScoredTrades } from "../../../core/probability/probabilityEngine"
import { calculatePositionSize } from "../../../core/risk/riskManager"

export default function TradeProbabilityPanel(){

 const [trades,setTrades] = useState<any[]>([])

 useEffect(()=>{

  const i = setInterval(()=>{

    scoreTradeIdeas()

    setTrades(getScoredTrades())

  },4000)

  return ()=>clearInterval(i)

 },[])

 const risk = calculatePositionSize(46,0.05)

 return (

  <div className="panel">

   <div className="h">AI Trade Scoring</div>

   <div style={{marginBottom:12}}>
     Account: $46
     <br/>
     Max Risk Per Trade: ${risk.maxRisk}
   </div>

   {trades.map((t,i)=>(

     <div key={i} style={{marginBottom:12}}>

       <b>{t.ticker}</b> — {t.setup}

       <div>
        Win Probability: {(t.probability*100).toFixed(0)}%
       </div>

       <div>
        Risk / Reward: 1 : {t.riskReward.toFixed(2)}
       </div>

       <div>
        Expected Move: {t.expectedMove}
       </div>

       <div>
        Suggested Contracts: {risk.suggestedContracts}
       </div>

     </div>

   ))}

  </div>

 )

}
