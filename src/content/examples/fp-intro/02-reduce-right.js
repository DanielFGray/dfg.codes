const nums = [1, 2, 3]
const result = nums.reduceRight((rest, value) => ({ value, rest }), null)
console.log(result)
