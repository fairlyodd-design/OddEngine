
import React,{useState,useEffect} from "react"

export default function ActivityTimeline(){

 const [events,setEvents]=useState([
  "System booted",
  "Morning digest generated",
  "Trading scanner ready"
 ])

 useEffect(()=>{
  const i=setInterval(()=>{
   setEvents(e=>[...e,"Event "+Math.floor(Math.random()*1000)])
  },5000)
  return()=>clearInterval(i)
 },[])

 return(
  <div className="activityTimeline">
   <h3>Activity Stream</h3>
   {events.map((e,i)=>(<div key={i}>{e}</div>))}
  </div>
 )
}
