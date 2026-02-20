const items = [
  { foo: 'a', bar: 1 },
  { foo: 'b', bar: 2 },
]
const prop = a => b => b[a]
console.log(items.map(prop('foo')))
const pluck = (a, b) => b.map(prop(a))
console.log(pluck('foo', items))
