
import React,{useState} from "react"
import { executeTrade } from "../../../execution/executionEngine"

export default function ExecutionEnginePanel(){

 const [log,setLog] = useState<string[]>([])

 function run(){

   const plan = {
     ticker:"NVDA",
     strategy:"Momentum Breakout",
     contract:"+3% OTM Call",
     size:1
   }

   const result = executeTrade(plan,46)

   setLog(l=>[result.success ? "Trade Executed" : "Trade Blocked",...l])

 }

 return (

   <div className="panel">

     <div className="h">Autonomous Execution Engine</div>

     <button onClick={run}>Execute Trade Plan</button>

     <div style={{marginTop:10}}>
       {log.map((l,i)=>(
         <div key={i}>{l}</div>
       ))}
     </div>

   </div>

 )

}
