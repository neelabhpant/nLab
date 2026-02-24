export function pearsonCorrelation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length)
  if (n < 2) return null

  let sumA = 0
  let sumB = 0
  for (let i = 0; i < n; i++) {
    sumA += a[i]
    sumB += b[i]
  }
  const meanA = sumA / n
  const meanB = sumB / n

  let cov = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < n; i++) {
    const dA = a[i] - meanA
    const dB = b[i] - meanB
    cov += dA * dB
    varA += dA * dA
    varB += dB * dB
  }

  const denom = Math.sqrt(varA * varB)
  if (denom === 0) return null
  return cov / denom
}
