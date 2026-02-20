const flatMap = (fn, a) => a.reduce((p, c) => p.concat(c), [])
console.log(flatMap(n => [n, n], [1, 2, 3, 4]))
