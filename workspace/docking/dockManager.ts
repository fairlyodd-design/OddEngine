
import { PanelLayout } from "../layout/workspaceLayout"

export function dockPanel(layout:PanelLayout[], panel:PanelLayout){

 const existing = layout.find(p=>p.id===panel.id)

 if(existing){
  Object.assign(existing,panel)
 }else{
  layout.push(panel)
 }

 return layout

}
