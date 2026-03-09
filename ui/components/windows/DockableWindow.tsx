
import React, { useState } from "react"

export default function DockableWindow({title, children}:any){

 const [pos,setPos] = useState({x:200,y:160})
 const [size,setSize] = useState({w:600,h:400})

 function drag(e:any){
  setPos({x:e.clientX,y:e.clientY})
 }

 return (

  <div
   className="dockWindow"
   style={{
    left:pos.x,
    top:pos.y,
    width:size.w,
    height:size.h,
    position:"absolute"
   }}
  >

   <div className="dockHeader" onMouseDown={drag}>
     {title}
   </div>

   <div className="dockBody">
     {children}
   </div>

  </div>

 )
}
