/**
 * OAuth configuration and flow
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL, URLSearchParams } from 'node:url'
import open from 'open'
import { debug, info, error as logError } from '../core/logger.js'
import { getAccountManager } from '../accounts/index.js'
import type { OAuthTokenResponse, StoredTokens } from '../quota/types.js'

// OAuth configuration
// Default credentials provided - users can override with environment variables if needed
const OAUTH_CONFIG = {
  clientId: process.env.ANTIGRAVITY_OAUTH_CLIENT_ID || '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
  clientSecret: process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET || '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',
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email'
  ]
}

interface OAuthOptions {
  noBrowser?: boolean
  port?: number
}

interface OAuthResult {
  success: boolean
  email?: string
  error?: string
}

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

/**
 * Get available port for callback server
 */
async function getAvailablePort(preferredPort?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(preferredPort || 0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        reject(new Error('Failed to get server address'))
      }
    })
    server.on('error', reject)
  })
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
  debug('oauth', 'Exchanging code for tokens')
  
  const params = new URLSearchParams({
    code,
    client_id: OAUTH_CONFIG.clientId,
    client_secret: OAUTH_CONFIG.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  })
  
  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })
  
  if (!response.ok) {
    const error = await response.text()
    debug('oauth', 'Token exchange failed', error)
    throw new Error(`Token exchange failed: ${response.status} ${error}`)
  }
  
  const data = await response.json() as OAuthTokenResponse
  debug('oauth', 'Token exchange successful')
  return data
}

/**
 * Get user email from access token
 */
async function getUserEmail(accessToken: string): Promise<string | undefined> {
  debug('oauth', 'Fetching user info')
  
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    
    if (response.ok) {
      const data = await response.json() as { email?: string }
      return data.email
    }
  } catch (err) {
    debug('oauth', 'Failed to get user info', err)
  }
  
  return undefined
}

/**
 * Fetch project ID from Cloud Code API during login
 * This is cached with tokens for efficiency during quota fetches
 */
async function fetchProjectId(accessToken: string): Promise<string | undefined> {
  debug('oauth', 'Fetching project ID from Cloud Code API')
  
  try {
    const response = await fetch('https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'antigravity/1.11.3 Darwin/arm64'
      },
      body: JSON.stringify({ 
        metadata: { 
          ideType: 'ANTIGRAVITY',
          platform: 'PLATFORM_UNSPECIFIED',
          pluginType: 'GEMINI'
        } 
      })
    })
    
    if (response.ok) {
      const data = await response.json() as Record<string, unknown>
      
      // Debug: print full response
      debug('oauth', `loadCodeAssist FULL response: ${JSON.stringify(data, null, 2)}`)
      
      // Try to extract cloudaicompanionProject
      const projectId = (data as any).cloudaicompanionProject
      debug('oauth', `Extracted cloudaicompanionProject: ${projectId}`)
      
      return typeof projectId === 'string' ? projectId : undefined
    }
    
    debug('oauth', `Failed to get project ID: ${response.status}`)
  } catch (err) {
    debug('oauth', 'Error fetching project ID', err)
  }
  
  return undefined
}

/**
 * Start OAuth login flow
 */
export async function startOAuthFlow(options: OAuthOptions = {}): Promise<OAuthResult> {
  const port = await getAvailablePort(options.port)
  const redirectUri = `http://127.0.0.1:${port}/callback`
  const state = generateState()
  
  debug('oauth', `Starting OAuth flow on port ${port}`)
  
  // Build authorization URL
  const authParams = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: OAUTH_CONFIG.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state
  })
  
  const authUrl = `${OAUTH_CONFIG.authUrl}?${authParams.toString()}`
  
  return new Promise((resolve) => {
    let resolved = false
    
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (resolved) return
      
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
      
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')
        const errorParam = url.searchParams.get('error')
        
        if (errorParam) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<html><body><h1>Login Failed</h1><p>You can close this window.</p></body></html>')
          resolved = true
          server.close()
          resolve({ success: false, error: errorParam })
          return
        }
        
        if (!code || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<html><body><h1>Invalid Request</h1><p>State mismatch or missing code.</p></body></html>')
          resolved = true
          server.close()
          resolve({ success: false, error: 'Invalid callback' })
          return
        }
        
        try {
          // Exchange code for tokens
          const tokenResponse = await exchangeCodeForTokens(code, redirectUri)
          
          // Get user email
          const email = await getUserEmail(tokenResponse.access_token)
          
          // Get project ID from Cloud Code API (for efficiency during quota fetches)
          let projectId: string | undefined
          try {
            projectId = await fetchProjectId(tokenResponse.access_token)
          } catch (err) {
            debug('oauth', 'Failed to fetch project ID during login (will fetch on demand)', err)
            // Continue without project ID - it will be fetched on demand
          }
          
          // Save tokens using account manager
          const tokens: StoredTokens = {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token || '',
            expiresAt: Date.now() + tokenResponse.expires_in * 1000,
            email,
            projectId
          }
          
          // Add/update account via account manager
          if (email) {
            getAccountManager().addAccount(tokens, email)
          }
          
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>Login Successful!</h1>
                <p>You are now logged in${email ? ` as <strong>${email}</strong>` : ''}.</p>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `)
          
          resolved = true
          server.close()
          resolve({ success: true, email })
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' })
          res.end('<html><body><h1>Login Failed</h1><p>Token exchange failed.</p></body></html>')
          resolved = true
          server.close()
          resolve({ success: false, error: err instanceof Error ? err.message : 'Unknown error' })
        }
      }
    })
    
    server.listen(port, '127.0.0.1', async () => {
      info('')
      info('Opening browser for Google login...')
      info('')
      
      if (options.noBrowser) {
        info('Open this URL in your browser:')
        info(authUrl)
      } else {
        try {
          await open(authUrl)
          info('If the browser did not open, visit this URL:')
          info(authUrl)
        } catch (err) {
          debug('oauth', 'Failed to open browser', err)
          info('Could not open browser. Please visit this URL:')
          info(authUrl)
        }
      }
      
      info('')
      info('Waiting for authentication...')
    })
    
    // Timeout after 2 minutes
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        server.close()
        resolve({ success: false, error: 'Login timed out' })
      }
    }, 2 * 60 * 1000)
  })
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
  debug('oauth', 'Refreshing access token')
  
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: OAUTH_CONFIG.clientId,
    client_secret: OAUTH_CONFIG.clientSecret,
    grant_type: 'refresh_token'
  })
  
  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })
  
  if (!response.ok) {
    const error = await response.text()
    debug('oauth', 'Token refresh failed', error)
    throw new Error(`Token refresh failed: ${response.status}`)
  }
  
  const data = await response.json() as OAuthTokenResponse
  debug('oauth', 'Token refresh successful')
  return data
}
