const ints = [1, 2, 3, 4]
const product = ints.reduce((prev, curr) => {
  prev.push(curr * curr)
  return prev
}, [])
console.log(product)
