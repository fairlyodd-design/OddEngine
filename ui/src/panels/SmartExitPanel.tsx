
import React,{useState} from "react"
import { monitorPosition } from "../../../portfolio/positionMonitor"

export default function SmartExitPanel(){

 const [log,setLog] = useState<any[]>([])

 function run(){

   const sample = {
     ticker:"NVDA",
     pnl:32,
     pnlDrop:2
   }

   const result = monitorPosition(sample)

   setLog(l=>[result,...l])

 }

 return (

   <div className="panel">

     <div className="h">Smart Exit Engine</div>

     <button onClick={run}>Evaluate Position</button>

     <div style={{marginTop:10}}>

       {log.map((r,i)=>(
         <div key={i}>
           {r.ticker} → {r.action}
         </div>
       ))}

     </div>

   </div>

 )

}
