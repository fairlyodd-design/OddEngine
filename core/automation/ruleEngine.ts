
import { on } from "../omniverse/eventBus"

type Rule = {
 trigger:string
 action:(payload:any)=>void
}

const rules:Rule[]=[]

export function createRule(rule:Rule){
 rules.push(rule)
 on(rule.trigger,rule.action)
}
