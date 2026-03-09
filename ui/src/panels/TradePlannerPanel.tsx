
import React,{useEffect,useState} from "react"
import { generateTradePlans,getTradePlans } from "../../../planner/tradePlanner"
import { formatTradePlan } from "../../../planner/models/tradePlanModel"
import { calculatePositionSize } from "../../../planner/risk/riskManager"

export default function TradePlannerPanel(){

 const [plans,setPlans] = useState<any[]>([])

 useEffect(()=>{

   const i = setInterval(()=>{

     const opportunities = [
       {ticker:"NVDA",type:"UNUSUAL_OPTIONS",probability:0.72},
       {ticker:"WBD",type:"MOMENTUM_SETUP",probability:0.64},
       {ticker:"SPY",type:"VOLATILITY_SPIKE",probability:0.58}
     ]

     generateTradePlans(opportunities)

     const formatted = getTradePlans().map(p=>{
       const plan = formatTradePlan(p)
       const size = calculatePositionSize(46,0.02)
       return {...plan,size}
     })

     setPlans(formatted)

   },3000)

   return ()=>clearInterval(i)

 },[])

 return (

   <div className="panel">

     <div className="h">Autonomous Trade Planner</div>

     {plans.map((p,i)=>(
       <div key={i}>
         {p.ticker} — {p.strategy} — {p.contract} — Size: {p.size}
       </div>
     ))}

   </div>

 )

}
