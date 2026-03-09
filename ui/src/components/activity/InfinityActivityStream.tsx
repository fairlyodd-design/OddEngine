
import React,{useState,useEffect} from "react"

export default function InfinityActivityStream(){

 const [events,setEvents]=useState([
  "OS initialized",
  "Market data connected",
  "Mission Control ready"
 ])

 useEffect(()=>{
  const i=setInterval(()=>{
   setEvents(e=>[...e,"Event "+Math.floor(Math.random()*10000)])
  },4000)

  return()=>clearInterval(i)
 },[])

 return(
  <div className="activityStream">
   <h3>System Activity</h3>

   {events.map((e,i)=>(
    <div key={i}>{e}</div>
   ))}
  </div>
 )
}
