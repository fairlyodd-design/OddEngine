
import React,{useState} from "react"

export default function CosmosWindow({title,children}:any){

 const [pos,setPos]=useState({x:240,y:180})

 function drag(e:any){
   setPos({x:e.clientX,y:e.clientY})
 }

 return(
  <div className="cosmosWindow" style={{left:pos.x,top:pos.y,position:"absolute"}}>
    <div className="cosmosHeader" onMouseDown={drag}>{title}</div>
    <div className="cosmosBody">{children}</div>
  </div>
 )
}
