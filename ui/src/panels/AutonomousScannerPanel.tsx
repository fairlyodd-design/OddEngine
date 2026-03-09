
import React,{useEffect,useState} from "react"

import { scanUnusualOptions,getOptionsAlerts } from "../../../scanner/options/unusualOptionsScanner"
import { scanSectorBreakouts,getSectorSignals } from "../../../scanner/sectors/sectorBreakoutScanner"
import { scanVolatility,getVolSignals } from "../../../scanner/volatility/volatilityScanner"
import { scanMomentum,getMomentumSignals } from "../../../scanner/momentum/momentumScanner"

export default function AutonomousScannerPanel(){

 const [alerts,setAlerts] = useState<any[]>([])

 useEffect(()=>{

   const i = setInterval(()=>{

     scanUnusualOptions()
     scanSectorBreakouts()
     scanVolatility()
     scanMomentum()

     const all = [
       ...getOptionsAlerts(),
       ...getSectorSignals(),
       ...getVolSignals(),
       ...getMomentumSignals()
     ]

     setAlerts(all.slice(0,20))

   },3000)

   return ()=>clearInterval(i)

 },[])

 return (

   <div className="panel">

     <div className="h">Autonomous Market Scanner</div>

     {alerts.map((a,i)=>(
       <div key={i}>
         {a.type} → {a.ticker || a.sector}
       </div>
     ))}

   </div>

 )

}
