
import React,{useState} from "react"

export default function SingularityWindow({title,children}:any){

 const [pos,setPos]=useState({x:260,y:180})
 const [size,setSize]=useState({w:800,h:520})

 function drag(e:any){
  setPos({x:e.clientX,y:e.clientY})
 }

 return(
  <div
   className="singularityWindow"
   style={{left:pos.x,top:pos.y,width:size.w,height:size.h,position:"absolute"}}
  >
   <div className="singularityHeader" onMouseDown={drag}>{title}</div>
   <div className="singularityBody">{children}</div>
  </div>
 )
}
