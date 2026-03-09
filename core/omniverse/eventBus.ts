
type Handler = (payload:any)=>void

const listeners:Record<string,Handler[]> = {}

export function emit(type:string,payload?:any){
 if(!listeners[type]) return
 listeners[type].forEach(fn=>fn(payload))
}

export function on(type:string,handler:Handler){
 if(!listeners[type]) listeners[type]=[]
 listeners[type].push(handler)
}

export function off(type:string,handler:Handler){
 if(!listeners[type]) return
 listeners[type]=listeners[type].filter(h=>h!==handler)
}
