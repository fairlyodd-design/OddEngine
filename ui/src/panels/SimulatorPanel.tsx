
import React,{useEffect,useState} from "react"
import { simulateTrades,getSimulationHistory } from "../../../core/simulator/tradeSimulator"
import { computePerformance } from "../../../core/simulator/models/performanceModel"
import { openPaperTrade,getPaperTrades } from "../../../core/paper-trader/paperTrader"

export default function SimulatorPanel(){

 const [history,setHistory] = useState<any[]>([])
 const [perf,setPerf] = useState<any>({})

 useEffect(()=>{

  const i = setInterval(()=>{

    simulateTrades()

    setHistory(getSimulationHistory())
    setPerf(computePerformance())

  },5000)

  return ()=>clearInterval(i)

 },[])

 const trades = getPaperTrades()

 return (

  <div className="panel">

   <div className="h">Adaptive Trade Simulator</div>

   <div style={{marginBottom:12}}>

     Trades: {perf.trades}
     <br/>
     Win Rate: {(perf.winRate*100 || 0).toFixed(0)}%
     <br/>
     Avg Return: {(perf.avgReturn*100 || 0).toFixed(1)}%

   </div>

   <div>

     <b>Simulated Trades</b>

     {history.map((h,i)=>(

       <div key={i}>

        {h.ticker} — {h.setup}

        <button onClick={()=>openPaperTrade(h)} style={{marginLeft:10}}>
         Paper Trade
        </button>

       </div>

     ))}

   </div>

   <div style={{marginTop:12}}>

    <b>Paper Trades</b>

    {trades.map((t,i)=>(
      <div key={i}>
       {t.ticker} — {t.status}
      </div>
    ))}

   </div>

  </div>

 )

}
