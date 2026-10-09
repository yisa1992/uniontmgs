'use client'

import { useState } from 'react'
import { loginAdmin } from '@/app/actions/auth'
import Link from 'next/link'

export default function AdminLoginPage() {
  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleStaffIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
    if (val.length > 0 && !val.startsWith('EMP-')) {
      if (val.startsWith('EMP')) {
        val = 'EMP-' + val.slice(3)
      } else {
        val = 'EMP-' + val.replace(/-/g, '')
      }
    }
    setStaffId(val)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('staffId', staffId)
    formData.append('password', password)

    const result = await loginAdmin(formData)
    if (result?.error) {
      setErrorMsg(result.error)
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #14b8a6 100%)',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '2.5rem',
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem',
              margin: '0 auto 1rem',
              letterSpacing: '0.02em',
            }}
          >
            UNION
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
            Admin Login
          </h1>
          <p style={{ margin: '0.4rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Sign in with your Staff ID and password
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              borderRadius: 10,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.875rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6,
              }}
            >
              Staff ID
            </label>
            <input
              type="text"
              required
              placeholder="e.g. EMP-1001"
              value={staffId}
              onChange={handleStaffIdChange}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                fontSize: '1rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6,
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  paddingRight: '4rem',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.9rem',
              borderRadius: 12,
              border: 'none',
              background: loading
                ? '#94a3b8'
                : 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
              color: 'white',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 8px 24px rgba(15, 118, 110, 0.35)',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in to Admin'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link
            href="/login"
            style={{ color: '#0f766e', fontSize: '0.875rem', textDecoration: 'none', fontWeight: 500 }}
          >
            ← Staff / Cashier login
          </Link>
        </div>
      </div>
    </div>
  )
}
