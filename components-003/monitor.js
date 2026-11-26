window.componentErrors = 0;
for (const type of ['error','unhandledrejection']) addEventListener(type,()=>window.componentErrors++,true);
