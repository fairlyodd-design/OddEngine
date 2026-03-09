
import React,{useState,useEffect} from "react"

export default function CosmosCommand(){

 const [open,setOpen] = useState(false)
 const [query,setQuery] = useState("")

 useEffect(()=>{
   const key=(e:any)=>{
     if(e.ctrlKey && e.key==="k"){
       e.preventDefault()
       setOpen(o=>!o)
     }
   }

   window.addEventListener("keydown",key)
   return()=>window.removeEventListener("keydown",key)
 },[])

 if(!open) return null

 return(
  <div className="cosmosCommand">
    <input
      autoFocus
      value={query}
      onChange={e=>setQuery(e.target.value)}
      placeholder="Command: open trading, run scan, open grow..."
    />
  </div>
 )
}
