
import React,{useEffect,useState} from "react"
import { evolveStrategies,getStrategyStats } from "../../../core/evolution/strategyEvolution"
import { computeStrategyWeights } from "../../../core/evolution/models/weightModel"

export default function StrategyEvolutionPanel(){

 const [stats,setStats] = useState<any[]>([])
 const [weights,setWeights] = useState<any[]>([])

 useEffect(()=>{

  const i = setInterval(()=>{

    evolveStrategies()

    setStats(getStrategyStats())
    setWeights(computeStrategyWeights())

  },6000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">Strategy Evolution Engine</div>

   {stats.map((s,i)=>(

     <div key={i} style={{marginBottom:12}}>

       <b>{s.strategy}</b>

       <div>
        Trades: {s.trades}
       </div>

       <div>
        Win Rate: {(s.winRate*100).toFixed(0)}%
       </div>

       <div>
        Avg Return: {(s.avgReturn*100).toFixed(1)}%
       </div>

     </div>

   ))}

   <div style={{marginTop:12}}>

    <b>Strategy Weights</b>

    {weights.map((w,i)=>(
      <div key={i}>
       {w.strategy} — weight {(w.weight*100).toFixed(1)}
      </div>
    ))}

   </div>

  </div>

 )
}
