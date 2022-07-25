import functions from './functions.js';
import MVVM from ' ../src/js/MVVM.js';

let vm =new MVVM({
    el:'#app',
    data:{
        message:'hello',

    }
})



test('测试取message值', () => {
    expect(functions.getVal(vm, 'message')).toBe('hello');
  });

test('测试取{{message}}值', () => {
    expect(functions.getVal(vm, '{{message}}')).toBe('hello');
  });



