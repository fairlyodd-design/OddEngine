
import { on } from "../eventBus"

export function registerAgent(name:string, setup:(on:any)=>void){

 console.log("Agent registered:", name)

 setup(on)

}
