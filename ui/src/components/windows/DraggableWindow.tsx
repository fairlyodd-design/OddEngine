
import React,{useState} from "react"

export default function DraggableWindow({title,children}:any){

 const [pos,setPos] = useState({x:120,y:120})

 function drag(e:any){
  setPos({x:e.clientX,y:e.clientY})
 }

 return(
  <div className="window" style={{left:pos.x,top:pos.y,position:"absolute"}}>
   <div className="windowHeader" onMouseDown={drag}>{title}</div>
   <div className="windowBody">{children}</div>
  </div>
 )
}
