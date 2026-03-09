
import React,{useState} from "react"

export default function WorkspaceManager(){

 const [workspace,setWorkspace] = useState("Home")

 const workspaces = [
  "Trading Desk",
  "Grow Control",
  "Creator Studio",
  "Family Planner"
 ]

 return(
  <div className="workspaceManager">
    <span>Workspace:</span>

    {workspaces.map(w=>(
      <button key={w} onClick={()=>setWorkspace(w)}>
        {w}
      </button>
    ))}

    <div className="workspaceLabel">
      Active: {workspace}
    </div>

  </div>
 )
}
