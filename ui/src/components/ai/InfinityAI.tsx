
import React,{useState} from "react"

export default function InfinityAI(){

 const [msg,setMsg]=useState("")
 const [log,setLog]=useState<string[]>([])

 function run(){
  setLog(l=>[...l,"User: "+msg])
  setLog(l=>[...l,"Homie: executing task..."])
  setMsg("")
 }

 return(
  <div className="infinityAI">
   <h3>Homie AI Autopilot</h3>

   <div className="aiLog">
    {log.map((l,i)=>(<div key={i}>{l}</div>))}
   </div>

   <input
    value={msg}
    onChange={e=>setMsg(e.target.value)}
    placeholder="Run command..."
   />

   <button onClick={run}>Execute</button>
  </div>
 )
}
