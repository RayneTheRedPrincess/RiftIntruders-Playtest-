export const algorithm='splitmix64-high32-v1';
export const seeds=['0000000000000000','0123456789abcdef'];
export const owner=(scope,side='a')=>'profile:'+scope+'-'+side;
export function catalog(){return new Map([
  ['skill:a',{kind:'skill',id:'skill:a',name:'Fixture',action:'spell',executionMs:1,cooldownMs:0,manaCost:0,target:{side:'self',maximum:1},effects:['effect:a']}],
  ['boon:a',{kind:'boon',id:'boon:a',name:'Fixture',achievement:'achievement:a',renown:1,weight:7,mode:'passive',effects:['effect:a']}],
  ['manifestation:a',{kind:'manifestation',id:'manifestation:a',name:'Fixture',category:'epiphany',skill:'skill:a',effects:['effect:a']}],
]);}
export function profile(id,renown=7,owned=true){return {version:1,id,renown,achievements:owned?['achievement:a']:[],ownedBoons:owned?['boon:a']:[]};}
export function character(id,experience=4,owned=true){return {version:1,id:'saved-character:same',profileId:id,template:null,race:'race:a',class:'class:a',subclass:'subclass:a',level:3,experience,skills:['skill:a'],selectedBoons:owned?['boon:a']:[],category:'epiphany',manifestation:'manifestation:a'};}
export const streams=states=>states.map((state,i)=>({id:'stream:'+['combat','loot'][i],algorithm,state}));
export const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
