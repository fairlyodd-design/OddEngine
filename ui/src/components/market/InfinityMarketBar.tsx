
import React,{useState,useEffect} from "react"

export default function InfinityMarketBar(){

 const [data,setData]=useState([
  {sym:"BTC",price:72000},
  {sym:"SPY",price:514},
  {sym:"NVDA",price:880},
  {sym:"ETH",price:4100},
  {sym:"AMD",price:180}
 ])

 useEffect(()=>{
  const i=setInterval(()=>{
   setData(d=>d.map(x=>({
    ...x,
    price:x.price+(Math.random()*12-6)
   })))
  },1200)

  return()=>clearInterval(i)
 },[])

 return(
  <div className="infinityMarketBar">
   {data.map(d=>(
    <span key={d.sym}>{d.sym} {d.price.toFixed(2)}</span>
   ))}
  </div>
 )
}
