
import React,{useState} from "react"

export default function SingularityAI(){

 const [msg,setMsg]=useState("")
 const [log,setLog]=useState<string[]>([])

 function send(){
  setLog([...log,"User: "+msg])
  setLog(l=>[...l,"Homie: working on it..."])
  setMsg("")
 }

 return(
  <div className="singularityAI">
   <h3>Homie AI Operator</h3>

   <div className="log">
    {log.map((l,i)=>(<div key={i}>{l}</div>))}
   </div>

   <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Command Homie..." />
   <button onClick={send}>Run</button>

  </div>
 )
}
