import functions from './functions.js';
import MVVM from ' ../src/js/MVVM.js';

let vm =new MVVM({
    el:'#app',
    data:{
        message:'hello',

    }
})



test('存入message的值', () => {
  expect(functions.setVal(vm,'message','aloha').toBe('aloha'));
});


