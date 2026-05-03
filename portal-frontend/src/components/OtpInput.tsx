import { useRef } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  length?: number
}

export default function OtpInput({ value, onChange, length = 6 }: Props) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  // Array.from ensures exactly `length` elements even when value is shorter
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  function handleChange(i: number, v: string) {
    const cleaned = v.replace(/\D/g, '').slice(-1)
    const next = digits.map((d, idx) => (idx === i ? cleaned : d)).join('')
    onChange(next)
    if (cleaned && i < length - 1) inputs.current[i + 1]?.focus()
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = digits.map((d, idx) => (idx === i ? '' : d)).join('')
        onChange(next)
      } else if (i > 0) {
        inputs.current[i - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft'  && i > 0)          inputs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < length - 1) inputs.current[i + 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (pasted) {
      onChange(pasted)
      inputs.current[Math.min(pasted.length, length - 1)]?.focus()
      e.preventDefault()
    }
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onFocus={e => e.target.select()}
          className="w-11 h-14 text-center text-2xl font-bold font-mono bg-gray-800 border-2 border-gray-700 rounded-lg focus:border-brand-500 focus:outline-none text-white transition-colors"
        />
      ))}
    </div>
  )
}
