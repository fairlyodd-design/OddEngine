
import React from "react"

export default function DockablePanel({title,children}:{title:string,children:any}){

 return (

  <div className="oe-panel">

   <div className="oe-panel-header">
     {title}
   </div>

   <div className="oe-panel-body">
     {children}
   </div>

  </div>

 )

}
