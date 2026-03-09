
import React, { useState } from "react"
import { saveWorkspace, loadWorkspace } from "../../core/workspace/workspaceManager"

export default function WorkspaceSelector(){

 const [name,setName] = useState("")

 function save(){

  const layout = {} // placeholder

  saveWorkspace(name, layout)

 }

 function load(){

  loadWorkspace(name)

 }

 return (

  <div className="workspacePanel">

   <div className="h">Workspaces</div>

   <input
    value={name}
    onChange={e=>setName(e.target.value)}
    placeholder="workspace name"
   />

   <button onClick={save}>Save</button>
   <button onClick={load}>Load</button>

  </div>

 )
}
