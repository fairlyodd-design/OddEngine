
import React,{useState} from "react"
import { evaluateTrade } from "../../../risk/riskGuardianAI"

export default function RiskGuardianPanel(){

 const [result,setResult] = useState("")

 function test(){

   const res = evaluateTrade(46,2)
   setResult(res.approved ? "Trade Approved" : "Trade Blocked")

 }

 return (

   <div className="panel">

     <div className="h">AI Risk Guardian</div>

     <button onClick={test}>Test Trade Risk</button>

     <div style={{marginTop:10}}>{result}</div>

   </div>

 )

}
