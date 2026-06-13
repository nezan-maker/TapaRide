import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

export interface PasskeyAuthOptions {
  error: string | null
  options: any
}

export interface PasskeyAuthResult {
  error: string | null
  result: any
}

export async function getPasskeyAuthOptions(): Promise<PasskeyAuthOptions> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/passkey/auth-options`, {
      method: 'GET',
      credentials: 'include',
    })
    
    if (!response.ok) {
      throw new Error('Failed to get passkey authentication options')
    }
    
    const options = await response.json()
    return { error: null, options }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error', options: null }
  }
}

export async function authenticateWithPasskey(options: any): Promise<PasskeyAuthResult> {
  try {
    const result = await startAuthentication(options)
    
    const response = await fetch(`${API_BASE}/api/auth/passkey/auth-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(result),
    })
    
    if (!response.ok) {
      throw new Error('Passkey authentication failed')
    }
    
    const data = await response.json()
    return { error: null, result: data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error', result: null }
  }
}

export async function getPasskeyRegistrationOptions(): Promise<PasskeyAuthOptions> {
  const token = localStorage.getItem('accessToken')
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/passkey/register-options`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    })
    
    if (!response.ok) {
      throw new Error('Failed to get passkey registration options')
    }
    
    const options = await response.json()
    return { error: null, options }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error', options: null }
  }
}

export async function registerPasskey(options: any): Promise<PasskeyAuthResult> {
  const token = localStorage.getItem('accessToken')
  
  try {
    const result = await startRegistration(options)
    
    const response = await fetch(`${API_BASE}/api/auth/passkey/register-verify`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(result),
    })
    
    if (!response.ok) {
      throw new Error('Passkey registration failed')
    }
    
    const data = await response.json()
    return { error: null, result: data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error', result: null }
  }
}