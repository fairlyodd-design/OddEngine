
import React, { useEffect, useState } from "react"
import { getCommands } from "../../../core/command/commandRegistry"
import { runCommand } from "../../../core/command/commandBus"

export default function CommandPalette(){

 const [open,setOpen] = useState(false)
 const [query,setQuery] = useState("")
 const [cmds,setCmds] = useState<any[]>([])

 useEffect(()=>{

  function key(e:KeyboardEvent){

   if(e.ctrlKey && e.key==="k"){
     e.preventDefault()
     setOpen(o=>!o)
   }

  }

  window.addEventListener("keydown",key)

  return ()=>window.removeEventListener("keydown",key)

 },[])

 useEffect(()=>{
   setCmds(getCommands())
 },[])

 if(!open) return null

 const filtered = cmds.filter(c =>
  c.title.toLowerCase().includes(query.toLowerCase())
 )

 return (

  <div className="commandOverlay">

   <div className="commandBox">

    <input
     autoFocus
     placeholder="Type a command..."
     value={query}
     onChange={e=>setQuery(e.target.value)}
    />

    <div className="commandResults">

     {filtered.map(c=>(

      <div
       key={c.id}
       className="commandItem"
       onClick={()=>{
        runCommand(c.id)
        setOpen(false)
       }}
      >
       {c.title}
      </div>

     ))}

    </div>

   </div>

  </div>

 )
}
