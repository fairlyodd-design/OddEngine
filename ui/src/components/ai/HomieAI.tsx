
import React,{useState} from "react"

export default function HomieAI(){
 const [msg,setMsg]=useState("")
 const [log,setLog]=useState<string[]>([])

 function send(){
  setLog([...log,msg])
  setMsg("")
 }

 return(
  <div className="aiPanel">
   <h3>Homie AI</h3>
   {log.map((l,i)=>(<div key={i}>{l}</div>))}
   <input value={msg} onChange={e=>setMsg(e.target.value)} />
   <button onClick={send}>Send</button>
  </div>
 )
}
