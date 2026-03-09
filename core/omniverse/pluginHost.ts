
import { registerPlugin } from "./capabilityRegistry"

type PluginModule = {
 name:string
 capabilities?:string[]
 activate:(ctx:any)=>void
}

const plugins:PluginModule[]=[]

export function loadPlugin(plugin:PluginModule,context:any){

 if(!plugin?.activate) return

 registerPlugin(plugin.name,plugin.capabilities || [])

 plugin.activate(context)

 plugins.push(plugin)

 console.log("Plugin loaded:",plugin.name)
}

export function listPlugins(){
 return plugins.map(p=>p.name)
}
