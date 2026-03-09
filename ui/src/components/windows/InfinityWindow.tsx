
import React,{useState} from "react"

export default function InfinityWindow({title,children}:any){

 const [pos,setPos]=useState({x:260,y:180})
 const [size,setSize]=useState({w:820,h:540})

 function drag(e:any){
  setPos({x:e.clientX,y:e.clientY})
 }

 return(
  <div
   className="infinityWindow"
   style={{left:pos.x,top:pos.y,width:size.w,height:size.h,position:"absolute"}}
  >
   <div className="infinityHeader" onMouseDown={drag}>{title}</div>
   <div className="infinityBody">{children}</div>
  </div>
 )
}
