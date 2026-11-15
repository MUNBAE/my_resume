'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

interface CopyButtonProps {
  text: string
  label?: string
  variant?: 'default' | 'outline' | 'secondary'
}

// 클립보드에 복사하고 결과를 알려준다. 실패하면 직접 복사하도록 안내한다.
export function CopyButton({
  text,
  label = '복사',
  variant = 'outline',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('클립보드에 복사했습니다.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사하지 못했습니다. 글상자를 선택해 직접 복사해 주세요.')
    }
  }

  return (
    <Button type="button" variant={variant} size="sm" onClick={copy}>
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      {copied ? '복사됨' : label}
    </Button>
  )
}
