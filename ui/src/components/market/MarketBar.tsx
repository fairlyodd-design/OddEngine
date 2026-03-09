
import React,{useState,useEffect} from "react"

export default function MarketBar(){

 const [data,setData] = useState([
  {sym:"BTC",price:72000},
  {sym:"SPY",price:514},
  {sym:"NVDA",price:880},
  {sym:"ETH",price:4100}
 ])

 useEffect(()=>{
  const i=setInterval(()=>{
    setData(d=>d.map(x=>({...x,price:x.price+(Math.random()*8-4)})))
  },1500)

  return()=>clearInterval(i)
 },[])

 return(
  <div className="marketBar">
    {data.map(d=>(
      <span key={d.sym}>
        {d.sym} {d.price.toFixed(2)}
      </span>
    ))}
  </div>
 )
}
