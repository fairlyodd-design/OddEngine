
import React,{useEffect,useState} from "react"

export default function SupernovaTape(){
 const [data,setData]=useState([
  {sym:"BTC",price:72000},
  {sym:"SPY",price:514},
  {sym:"NVDA",price:880}
 ])

 useEffect(()=>{
  const i=setInterval(()=>{
   setData(d=>d.map(x=>({...x,price:x.price+(Math.random()*6-3)})))
  },1500)
  return()=>clearInterval(i)
 },[])

 return(
  <div className="superTape">
   {data.map(d=>(<span key={d.sym}>{d.sym} {d.price.toFixed(2)}</span>))}
  </div>
 )
}
