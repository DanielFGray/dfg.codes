const partition = (fn, a) =>
  a.reduce(
    (p, c) => {
      const idx = Number(fn(c))
      p[idx].push(c)
      return p
    },
    [[], []],
  )
console.log(partition(n => n % 2 === 0, [1, 2, 3, 4]))
