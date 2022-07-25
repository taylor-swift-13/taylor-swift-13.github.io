export default {
  add(a, b) {
    return a + b;
  },
 
  isDirective(name){
    return name.includes('v-');
  },

setVal(vm,expr,value){
  expr =expr.split('.');
  return expr.reduce((prev,next,currentIndex)=>{
      if(currentIndex === expr.length-1){
          return prev[next]=value;
      }
      return prev[next];
  },vm.$data)
},

getVal(vm,expr){
  expr=expr.split('.');
 return expr.reduce((prev,next)=>{
      return prev[next];
  },vm.$data);
},

getTextVal(vm,expr){
   return  expr.replace(/\{\{([^}]+)\}\}/g,(...rest)=>{
        return this.getVal(vm,[1]);
    })
}
  
}