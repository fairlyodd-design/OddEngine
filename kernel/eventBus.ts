
type Handler = (payload:any)=>void

const listeners:Record<string,Handler[]> = {}

export function emit(event:string, payload:any){
 if(!listeners[event]) return
 listeners[event].forEach(h=>h(payload))
}

export function on(event:string, handler:Handler){
 if(!listeners[event]) listeners[event] = []
 listeners[event].push(handler)
}
