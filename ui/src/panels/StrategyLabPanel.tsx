
import React,{useEffect,useState} from "react"
import { runEvolutionCycle,getTopStrategies } from "../../../core/rl/rlEngine"

export default function StrategyLabPanel(){

 const [strategies,setStrategies] = useState<any[]>([])

 useEffect(()=>{

  const i = setInterval(async ()=>{

    await runEvolutionCycle()

    setStrategies(getTopStrategies())

  },6000)

  return ()=>clearInterval(i)

 },[])

 return (

  <div className="panel">

   <div className="h">AI Strategy Lab</div>

   {strategies.map((s,i)=>(

     <div key={i} style={{marginBottom:12}}>

       <b>{s.name}</b>

       <div>
        Win Rate: {(s.winRate*100).toFixed(0)}%
       </div>

       <div>
        Score: {s.score.toFixed(2)}
       </div>

       <div>
        Trades Tested: {s.trades}
       </div>

     </div>

   ))}

  </div>

 )
}
