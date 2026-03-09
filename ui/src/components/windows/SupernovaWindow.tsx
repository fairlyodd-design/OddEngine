
import React,{useState} from "react"

export default function SupernovaWindow({title,children}:any){
 const [pos,setPos]=useState({x:120,y:120})

 function drag(e:any){
  setPos({x:e.clientX,y:e.clientY})
 }

 return(
  <div className="superWindow" style={{left:pos.x,top:pos.y,position:"absolute"}}>
   <div className="superHeader" onMouseDown={drag}>{title}</div>
   <div className="superBody">{children}</div>
  </div>
 )
}
