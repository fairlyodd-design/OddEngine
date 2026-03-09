
import React,{useState} from "react"
import { runOperatorQuery } from "../../../core/operator/operatorEngine"
import { setOperatorAnswer,getOperatorAnswer } from "../../../core/operator/operatorBus"

export default function OperatorPanel(){

 const [query,setQuery] = useState("")
 const [answer,setAnswer] = useState<any>(null)

 async function ask(){

   const result = await runOperatorQuery(query)

   setOperatorAnswer(result)

   setAnswer(result)

 }

 return (

  <div className="panel">

   <div className="h">AI Operator</div>

   <input
    placeholder="Ask OddEngine..."
    value={query}
    onChange={e=>setQuery(e.target.value)}
   />

   <button onClick={ask}>Ask</button>

   {answer && (
    <div>

      <div><b>Answer</b></div>
      <div>{answer.answer}</div>

      <div style={{marginTop:6}}>
       Confidence: {(answer.confidence*100).toFixed(0)}%
      </div>

    </div>
   )}

  </div>

 )

}
