import { actionButton, namedPanel, disclosure } from './controls.js';
const life=new AbortController(),panel=namedPanel('Action choices');
let count=0;
const output=document.createElement('output');
output.value='0';
const buttons=['basic','attack','spell','dust'].map(role=>{
  const item=actionButton(role,()=>{
    count++;
    output.value=String(count);
    item.update(true,false);
  },life.signal);
  item.update(false,role==='dust');
  return item.button;
});
const menu=disclosure('Show actions',buttons,life.signal);
panel.append(menu.root,output);
document.querySelector('main').append(panel);
export function dispose() { life.abort(); }
