//数据劫持
class Observer{
    constructor(data){
        this.observe(data);
    }

    observe(data){
        if(!data||typeof data!=='object'){
            return;
        
        }

        Object.keys(data).forEach(key=>{
            this.defineReactive(data,key,data[key]);
            this.observe(data[key]);
        });
    }

    defineReactive(obj,key,value){
        let that=this;
        let dep=new Dep();
        Object.defineProperty(obj,key,{
            enumerable:true,
            configurable :true,
            get(){
                Dep.target && dep.addSub(Dep.target)
                return value;
            },
            set(newValue){
                console.log(newValue)
                if(newValue!=value){
                    that.observe(newValue);
                    value=newValue;
                    dep.notify();
                }
            }
        })
    }
}

//发布订阅模式
class Dep{
    constructor(){
        this.subs=[]
    }
    addSub(watcher){
        this.subs.push(watcher);
    }
    notify(){
        console.log(this.subs)
        this.subs.forEach(watcher=>watcher.update());
    }
}