import functions from './functions.js';

test('测试判断v-model', () => {
    expect(functions.isDirective('v-model')).toBeTruthy();
  });

test('测试判断{{text}}', () => {
    expect(functions.isDirective('{{text}}')).toBeFalsy();
  });


