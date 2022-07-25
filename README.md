##                                                                  MVVM 简易实现

姓名：杨范芃

学校：南京大学

专业：软工

年级：20

QQ：506356719

打开  https://taylor-swift-13.github.io 即可预览效果 


### 1.MVVM原理

Vue响应式原理最核心的方法便是通过Object.defineProperty()来实现对属性的劫持，达到监听数据变动的目的，无疑这个方法是本文中最重要、最基础的内容之一

整理了一下，要实现mvvm的双向绑定，就必须要实现以下几点：

- 1、实现一个数据监听器Observer，能够对数据对象的所有属性进行监听，如有变动可拿到最新值并通知订阅者
- 2、实现一个指令解析器Compile，对每个元素节点的指令进行扫描和解析，根据指令模板替换数据，以及绑定相应的更新函数
- 3、实现一个Watcher，作为连接Observer和Compile的桥梁，能够订阅并收到每个属性变动的通知，执行指令绑定的相应回调函数，从而更新视图
- 4、mvvm入口函数，整合以上三者



### 2.指令解析器Compile

实现一个指令解析器Compile，对每个元素节点的指令进行扫描和解析，根据指令模板替换数据，以及绑定相应的更新函数,添加监听数据的订阅者，一旦数据有变动，收到通知，更新视图，如图所示：

#### 2.1 初始化

使用文档碎片

```javascript
class Compile{
    constructor(el,vm){
        this.el=this.isElementNode(el)?el:document.querySelector(el);
        this.vm=vm;
        if(this.el){
            
            let fragment = this.nodeToFragment(this.el);

            this.compile(fragment);

            this.el.appendChild(fragment);
        }
    }
    
     isElementNode(node){
        return node.nodeType ===1 ;
    }
    
     nodeToFragment(el){
       let fragment =document.createDocumentFragment();
       let firstChild;
       while(firstChild=el.firstChild){
           fragment.appendChild(firstChild);
       }
       return fragment;
    }
    
}
```



#### 2.2 编译模板

从内存中获取子节点

对子节点的类型进行不同的处理

```javascript
 compile(fragment){
        let childNodes=fragment.childNodes
        Array.from(childNodes).forEach(node=>{
            if(this.isElementNode(node)){
                console.log('element',node);
                this.compileElement(node);
                this.compile(node)
            }else {
                 this.compileText(node);
            }  
        })
    }
```

###### 2.2.1 编译元素节点

```javascript
 compileElement(node){
       let attrs=node.attributes;
       Array.from(attrs).forEach(attr=>{
           let attrName=attr.name;
           if(this.isDirective(attrName)){
              let expr = attr.value;
              let [,type]  = attrName.split('-');
              CompileUtil[type](node,this.vm,expr);
           }
       })
    }

isDirective(name){
        return name.includes('v-');
    }
```

###### 2.2.2 编译文本节点

```javascript
compileText(node){
       let expr =node.textContent;
       let reg=/\{\{([^}]+)\}\}/g;
       if(reg.test(expr)){
            CompileUtil['text'](node,this.vm,expr);
       }
    }
```

###### 2.2.3 处理元素/处理文本/处理事件

compileUtil执行真正的编译操作,根据不同的指令来做不同的处理

通过updater函数来初始化视图

```javascript
CompileUtil ={

    getVal(vm,expr){
      expr=expr.split('.');
     return expr.reduce((prev,next)=>{
          return prev[next];
      },vm.$data);
    },
    getTextVal(vm,expr){
        console.log(expr)
       return  expr.replace(/\{\{([^}]+)\}\}/g,(...arguments)=>{
            return this.getVal(vm,arguments[1]);
        })
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

    text(node,vm,expr){
        let updateFn=this.updater['textUpdater'];
        let value;
        if(expr.indexOf('{{') !==-1){ //{{message}}
            value= this.getTextVal(vm,expr);
            expr.replace(/\{\{([^}]+)\}\}/g,(...arguments)=>{
            new Watcher(vm,arguments[1],(newValue)=>{
                updateFn && updateFn(node,this.getTextVal(vm,expr));
            });
            })
        } else {//v-text
        value=this.getVal(vm,expr);
        new Watcher(vm,expr,(newValue)=>{
            updateFn && updateFn(node,this.getVal(vm,expr));
       });
    }
    updateFn && updateFn(node,value);
},
   
    model(node,vm,expr){
        let updateFn=this.updater['modelUpdater'];
       new Watcher(vm,expr,(newValue)=>{
            updateFn && updateFn(node,this.getVal(vm,expr));
        });
        node.addEventListener('input',(e)=>{
            let newValue = e.target.value;
            this.setVal(vm,expr,newValue)
        })
        updateFn && updateFn(node,this.getVal(vm,expr));
    },

    updater:{
        textUpdater(node,value){
            node.textContent=value;
        },
        modelUpdater(node,value){
            node.value=value;
        },

    }
}
```



### 3.数据劫持 Observer

利用`Obeject.defineProperty()`来监听属性变动 那么将需要observe的数据对象进行递归遍历，包括子属性对象的属性，都加上 `setter`和`getter` 这样的话，给这个对象的某个值赋值，就会触发`setter`，从而监听到了数据变化。

```javascript
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


```

### 4.观察者模式Watcher

它作为连接Observer和Compile的桥梁，能够订阅并收到每个属性变动的通知，执行指令绑定的相应回调函数，从而更新视图

只要所做事情:

1、在自身实例化时往属性订阅器(dep)里面添加自己

2、自身必须有一个update()方法

3、待属性变动dep.notify()通知时，能调用自身的update()方法，并触发Compile中绑定的回调。

```javascript
class Watcher{
   constructor(vm,expr,cb){
       this.vm=vm;
       this.expr=expr;
       this.cb=cb;

       this.value =this.get();
   }
   getVal(vm,expr){
    expr=expr.split('.');
    return expr.reduce((prev,next)=>{
        return prev[next];
    },vm.$data);
  }

  get(){
      Dep.target=this;
      let value=this.getVal(this.vm,this.expr);
      Dep.target=null;
      return value;
  }

  update(){
     
      let newValue =this.getVal(this.vm,this.expr);
      let oldValue =this.value;
      if(newValue!=oldValue){
          this.cb(newValue);
      }
  }

}
```



### 5.发布订阅模式

维护一个数组，用来收集订阅者，数据变动触发notify，

再调用订阅者的update方法

创建Dep

- 添加订阅者
- 定义通知的方法

```javascript
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
```



### 6.MVVM整合

#### 6.1 初始化

MVVM作为数据绑定的入口，整合Observer、Compile和Watcher三者，通过Observer来监听自己的model数据变化，通过Compile来解析编译模板指令，最终利用Watcher搭起Observer和Compile之间的通信桥梁，达到数据变化 -> 视图更新；视图交互变化(input) -> 数据model变更的双向绑定效果

```javascript
class MVVM{
     constructor(options){

      this.$el=options.el;
      this.$data= options.data;
    

    if(this.$el){
        new Observer(this.$data);
        this.proxyData(this.$data);
        new Compile(this.$el,this);
    }
  } 
}
```



#### 6.2 代理proxy

 我们在使用vue的时候,通常可以直接vm.msg来获取数据,这是因为vue源码内部做了一层代理.也就是说把数据获取操作vm上的取值操作 都代理到vm.$data上

```javascript
proxyData(data){
     Object.keys(data).forEach(key=>{
         Object.defineProperty(this,key,{
             get(){
                 return data[key]
             },
             set(newValue){
                 return data[key]=newValue
             }
         })
     })

 }
```

