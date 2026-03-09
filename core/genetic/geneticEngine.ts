
import { mutateStrategy, crossoverStrategies } from "./models/genome"
import { backtestStrategy } from "../rl/backtest/backtestEngine"

let population:any[] = []

export async function runGeneration(){

 if(population.length === 0){
   seedPopulation()
 }

 const results:any[] = []

 for(const strat of population){
   const res = await backtestStrategy(strat)
   results.push({...strat, score:res.score, winRate:res.winRate})
 }

 results.sort((a,b)=>b.score-a.score)

 const survivors = results.slice(0,5)

 const nextGen:any[] = [...survivors]

 while(nextGen.length < 12){
   const a = survivors[Math.floor(Math.random()*survivors.length)]
   const b = survivors[Math.floor(Math.random()*survivors.length)]
   const child = mutateStrategy(crossoverStrategies(a,b))
   nextGen.push(child)
 }

 population = nextGen

}

function seedPopulation(){

 const tickers = ["WBD","SPY","TQQQ","VIX"]

 for(let i=0;i<10;i++){
   population.push({
     ticker:tickers[i%tickers.length],
     entry:"breakout",
     exit:"ema_cross",
     stop:Math.random()*0.1,
     takeProfit:0.1+Math.random()*0.4
   })
 }

}

export function getPopulation(){
 return population
}
