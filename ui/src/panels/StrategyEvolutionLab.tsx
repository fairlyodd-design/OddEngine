
import React,{useEffect,useState} from "react"
import { runGeneration,getPopulation } from "../../../core/genetic/geneticEngine"
import { detectMarketRegime } from "../../../core/regime/regimeDetector"

export default function StrategyEvolutionLab(){

 const [population,setPopulation] = useState<any[]>([])
 const [regime,setRegime] = useState("UNKNOWN")

 useEffect(()=>{

  const i = setInterval(async()=>{

    await runGeneration()

    setPopulation(getPopulation())

    const r = detectMarketRegime(
      20 + Math.random()*15,
      Math.random()*2-1
    )

    setRegime(r)

  },5000)

  return ()=>clearInterval(i)

 },[])

 return (

 <div className="panel">

  <div className="h">Genetic Strategy Lab</div>

  <div style={{marginBottom:10}}>
    Market Regime: <b>{regime}</b>
  </div>

  {population.map((p,i)=>(
    <div key={i} style={{marginBottom:10}}>

      <b>{p.ticker}</b>

      <div>
        Entry: {p.entry}
      </div>

      <div>
        Exit: {p.exit}
      </div>

      <div>
        Stop: {(p.stop*100).toFixed(1)}%
      </div>

      <div>
        TP: {(p.takeProfit*100).toFixed(1)}%
      </div>

    </div>
  ))}

 </div>

 )

}
