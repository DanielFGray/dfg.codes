function map(func, arr) {
  const state = []
  for (let i = 0, l = arr.length; i < l; ++i) {
    state.push(func(arr[i]))
  }
  return state
}
console.log(map(n => n * n, [1, 2, 3]))
