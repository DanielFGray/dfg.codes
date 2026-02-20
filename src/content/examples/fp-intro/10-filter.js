const filter = (fn, a) => a.reduce((p, c) => (fn(c) ? p.concat([c]) : p), [])
const isEven = n => n % 2 === 0
console.log(filter(isEven, [1, 2, 3, 4]))
