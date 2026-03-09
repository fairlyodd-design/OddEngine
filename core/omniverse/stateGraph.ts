
type Subscriber = (value:any)=>void

const state:Record<string,any> = {}
const subs:Record<string,Subscriber[]> = {}

export function setState(key:string,value:any){
 state[key]=value
 subs[key]?.forEach(fn=>fn(value))
}

export function getState(key:string){
 return state[key]
}

export function subscribe(key:string,fn:Subscriber){
 if(!subs[key]) subs[key]=[]
 subs[key].push(fn)
}
