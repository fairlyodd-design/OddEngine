
import React, { useState } from "react"
import { runAICommand } from "../../../../core/ai-command/aiCommandRouter"

export default function AISmartCommand(){

 const [input,setInput] = useState("")
 const [history,setHistory] = useState<string[]>([])

 async function run(){

  await runAICommand(input)

  setHistory(h=>[input,...h])

  setInput("")

 }

 return (

  <div className="aiSmartCommand">

   <div className="h">AI Command</div>

   <input
    placeholder="Type natural command..."
    value={input}
    onChange={e=>setInput(e.target.value)}
   />

   <button onClick={run}>
     Run
   </button>

   <div className="aiHistory">

    {history.map((h,i)=>(
      <div key={i}>{h}</div>
    ))}

   </div>

  </div>

 )
}
