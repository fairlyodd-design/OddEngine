
import React,{useState} from "react"

export default function AICopilotPanel(){

 const [input,setInput] = useState("")
 const [log,setLog] = useState<string[]>([])

 function send(){
  setLog([...log,"Homie: "+input])
  setInput("")
 }

 return(
  <div className="aiPanel">
   <h3>Homie AI</h3>

   <div className="log">
    {log.map((l,i)=>(<div key={i}>{l}</div>))}
   </div>

   <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask Homie..." />
   <button onClick={send}>Send</button>
  </div>
 )
}
