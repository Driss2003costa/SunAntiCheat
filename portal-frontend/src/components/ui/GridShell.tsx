import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  maxWidth?: 'lg' | 'xl' | '2xl' | 'full'
}

const widthMap: Record<string, string> = {
  lg:   'max-w-[1280px]',
  xl:   'max-w-[1440px]',
  '2xl':'max-w-[1600px]',
  full: 'max-w-[1920px]',
}

export default function GridShell({ children, className = '', maxWidth = '2xl' }: Props) {
  return (
    <main className={`min-h-screen pb-28 px-4 sm:px-6 lg:px-10 xl:px-16 2xl:px-24 pt-8 lg:pt-12 ${className}`}>
      <div className={`${widthMap[maxWidth]} mx-auto w-full`}>{children}</div>
    </main>
  )
}
