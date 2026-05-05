const SYMBOLS: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'],  [90,  'XC'], [50,  'L'], [40,  'XL'],
  [10,  'X'],  [9,   'IX'], [5,   'V'], [4,   'IV'],
  [1,   'I'],
]

export function toRoman(num: number): string {
  if (num <= 0 || num > 3999) return String(num)
  let result = ''
  let remaining = num
  for (const [value, sym] of SYMBOLS) {
    while (remaining >= value) {
      result += sym
      remaining -= value
    }
  }
  return result
}

export default function RomanNumeral({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span
      className={`font-codex-display ${className}`}
      style={{ letterSpacing: '0.1em', fontWeight: 600 }}
    >
      {toRoman(value)}
    </span>
  )
}
