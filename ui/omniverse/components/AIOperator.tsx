
import React, { useState } from "react"

export default function AIOperator(){

 const [input,setInput] = useState("")
 const [log,setLog] = useState<string[]>([])

 function run(){

  const response = "AI task executed: " + input

  setLog([...log,response])

  setInput("")

 }

 return (

  <div className="aiOperator">

   <div className="h">AI Operator</div>

   <input
    value={input}
    onChange={e=>setInput(e.target.value)}
    placeholder="Ask OddEngine AI..."
   />

   <button onClick={run}>
    Run
   </button>

   <div className="aiLog">

    {log.map((l,i)=>(
      <div key={i}>{l}</div>
    ))}

   </div>

  </div>

 )

}
