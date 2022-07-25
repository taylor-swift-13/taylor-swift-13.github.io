import functions from './functions.js';


test('3 equal 3', () => {
  expect(3).toBe(3);
});

test('adds 1 + 2 to equal 3', () => {
  expect(functions.add(1, 2)).toBe(3);
});