function reduce(fn, init, a) {
  if (a.length === 0) return init
  return reduce(fn, fn(init, a[0]), a.slice(1))
}
function reduceRight(fn, init, a) {
  if (a.length === 0) return init
  return reduceRight(fn, fn(init, a[a.length - 1]), a.slice(0, -1))
}
const nums = [1, 2, 3, 4]
console.log(reduce((a, b) => a + b, 0, nums))
console.log(reduceRight((rest, value) => ({ value, rest }), null, nums))
