'use client'

import { type FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { InputText } from 'primereact/inputtext'
import { Message } from 'primereact/message'
import { Password } from 'primereact/password'
import { ApiException, api } from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountName, setAccountName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.register({ email, password, accountName: accountName || undefined })
      router.push('/videos')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Create account" subTitle="Start processing video" className="w-full max-w-md shadow-lg">
      <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Message severity="error" text={error} />}
          <span className="flex flex-col gap-1">
            <label htmlFor="email">Email</label>
            <InputText id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </span>
          <span className="flex flex-col gap-1">
            <label htmlFor="password">Password (min 8 chars)</label>
            <Password
              inputId="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              toggleMask
            />
          </span>
          <span className="flex flex-col gap-1">
            <label htmlFor="account">Account name (optional)</label>
            <InputText id="account" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </span>
          <Button type="submit" label="Create account" loading={loading} />
          <p className="text-sm text-center text-surface-600">
            Have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </Card>
  )
}
