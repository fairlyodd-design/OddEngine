
import { generateStrategyVariants } from "./mutator/strategyMutator"
import { backtestStrategy } from "./backtest/backtestEngine"

const strategies:any[] = []

export async function runEvolutionCycle(){

 const variants = generateStrategyVariants()

 for(const strat of variants){

   const result = await backtestStrategy(strat)

   strategies.push({
     ...strat,
     score:result.score,
     winRate:result.winRate,
     trades:result.trades
   })

 }

 strategies.sort((a,b)=>b.score-a.score)

}

export function getTopStrategies(){

 return strategies.slice(0,10)

}
