const ints = [1, 2, 3, 4]
const map = (fn, a) =>
  a.reduce((prev, curr) => {
    prev.push(fn(curr))
    return prev
  }, [])
console.log(map(n => n * n, ints))
