
type Capability = string

const registry:Record<string,Capability[]> = {}

export function registerPlugin(name:string,capabilities:Capability[]){
 registry[name]=capabilities
}

export function hasCapability(plugin:string,cap:Capability){
 return registry[plugin]?.includes(cap)
}
