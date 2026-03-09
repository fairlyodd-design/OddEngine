
import React,{useEffect,useState} from "react"

export default function DataTape(){

 const [data,setData] = useState([
  {sym:"BTC",price:72000},
  {sym:"SPY",price:514},
  {sym:"NVDA",price:880},
  {sym:"ETH",price:4100}
 ])

 useEffect(()=>{
  const i=setInterval(()=>{
   setData(d=>d.map(x=>({...x,price:x.price+(Math.random()*10-5)})))
  },2000)
  return()=>clearInterval(i)
 },[])

 return(
  <div className="dataTape">
   {data.map(d=>(
    <span key={d.sym}>{d.sym} {d.price.toFixed(2)}</span>
   ))}
  </div>
 )
}
