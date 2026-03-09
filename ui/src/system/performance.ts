
export function debounce(fn:Function,delay:number){

 let t:any

 return (...args:any[])=>{

  clearTimeout(t)

  t = setTimeout(()=>fn(...args),delay)

 }

}
