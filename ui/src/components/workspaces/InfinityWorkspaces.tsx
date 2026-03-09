
import React,{useState} from "react"

export default function InfinityWorkspaces(){

 const [active,setActive]=useState("Home")

 const workspaces=[
  "Home",
  "Trading Desk",
  "Grow Control",
  "Creator Studio",
  "Family Planner"
 ]

 return(
  <div className="infinityWorkspaces">

   {workspaces.map(w=>(
    <button key={w} onClick={()=>setActive(w)}>
      {w}
    </button>
   ))}

   <span className="workspaceActive">
    Active: {active}
   </span>

  </div>
 )
}
