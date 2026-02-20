const ints = [1, 2, 3, 4]
const squared = []
for (let i = 0, length = ints.length; i < length; ++i) {
  squared.push(ints[i] * ints[i])
}
console.log(squared)
