
import React,{useState} from "react"

export default function SingularityWorkspaces(){

 const [active,setActive]=useState("Home")

 const workspaces=[
  "Home",
  "Trading Desk",
  "Grow Control",
  "Creator Studio"
 ]

 return(
  <div className="singularityWorkspaces">
   {workspaces.map(w=>(
    <button key={w} onClick={()=>setActive(w)}>
      {w}
    </button>
   ))}

   <span className="workspaceActive">Active: {active}</span>
  </div>
 )
}
