
import React,{useState} from "react"
import { askCopilot } from "../../../../ai/copilot/tradeCopilot"

export default function AICopilotPanel(){

 const [messages,setMessages] = useState<any[]>([])
 const [input,setInput] = useState("")

 function send(){

   const response = askCopilot(input)

   setMessages([...messages,{user:input},{ai:response}])
   setInput("")

 }

 return (

  <div className="oe-copilot">

   <div className="oe-copilot-log">
     {messages.map((m,i)=>(
       <div key={i}>
         {m.user && <div>User: {m.user}</div>}
         {m.ai && <div>AI: {m.ai}</div>}
       </div>
     ))}
   </div>

   <div className="oe-copilot-input">
     <input value={input} onChange={e=>setInput(e.target.value)} />
     <button onClick={send}>Send</button>
   </div>

  </div>

 )

}
