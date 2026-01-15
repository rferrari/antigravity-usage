import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { probeForConnectAPI } from '../../src/local/port-prober.js'
import * as https from 'https'
import * as http from 'http'
import { EventEmitter } from 'events'

// Mock http and https
vi.mock('http')
vi.mock('https')

describe('port-prober', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // Helper to mock request
  function mockRequest(module: any, statusCode?: number, error?: Error, delay = 0) {
    // Create a request object that is also an EventEmitter
    const req = new EventEmitter() as any
    req.end = vi.fn()
    req.write = vi.fn() // Add write method for POST requests
    req.destroy = vi.fn()
    
    module.request.mockImplementation((options: any, callback: any) => {
      setTimeout(() => {
        if (error) {
          req.emit('error', error)
        } else if (statusCode) {
          const res = new EventEmitter() as any
          res.statusCode = statusCode
          res.resume = vi.fn()
          callback(res)
        }
      }, delay)
      
      return req
    })
    
    return req
  }

  describe('probeForConnectAPI', () => {
    it('should find HTTPS endpoint', async () => {
      // Setup HTTPS to succeed with HTTP 200 (valid Connect RPC response)
      mockRequest(https, 200)
      // Setup HTTP to fail
      mockRequest(http, undefined, new Error('Connection refused'))
      
      const result = await probeForConnectAPI([42001])
      
      expect(result).toEqual({
        baseUrl: 'https://127.0.0.1:42001',
        protocol: 'https',
        port: 42001
      })
      
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: '127.0.0.1',
          port: 42001,
          method: 'POST',
          path: '/exa.language_server_pb.LanguageServerService/GetUnleashData',
          rejectUnauthorized: false
        }),
        expect.any(Function)
      )
    })

    it('should fallback to HTTP if HTTPS fails', async () => {
      // Setup HTTPS to fail
      mockRequest(https, undefined, new Error('SSL Error'))
      // Setup HTTP to succeed
      mockRequest(http, 200)
      
      const result = await probeForConnectAPI([42001])
      
      expect(result).toEqual({
        baseUrl: 'http://localhost:42001',
        protocol: 'http',
        port: 42001
      })
    })

    it('should try multiple ports', async () => {
      const ports = [1000, 2000, 3000]
      
      // HTTPS fails on all
      mockRequest(https, undefined, new Error('Connection refused'))
      
      // HTTP succeeds only on 2000
      vi.mocked(http.request).mockImplementation((options: any, callback: any) => {
        const req = new EventEmitter() as any
        req.end = vi.fn()
        req.write = vi.fn() // Add write method
        req.destroy = vi.fn()
        
        const port = Number(options.port)
        
        setTimeout(() => {
          if (port === 2000) {
            const res = new EventEmitter() as any
            res.statusCode = 200
            res.resume = vi.fn()
            callback(res)
          } else {
            req.emit('error', new Error('Connection refused'))
          }
        }, 10)
        
        return req
      })
      
      const result = await probeForConnectAPI(ports)
      
      expect(result).toEqual({
        baseUrl: 'http://localhost:2000',
        protocol: 'http',
        port: 2000
      })
    })

    it('should return null if no port works', async () => {
      mockRequest(https, undefined, new Error('Connection refused'))
      mockRequest(http, undefined, new Error('Connection refused'))
      
      const result = await probeForConnectAPI([1234])
      
      expect(result).toBeNull()
    })

    it('should reject non-200 responses (like 404)', async () => {
      // Non-200 responses should be rejected by the new Connect RPC prober
      // HTTPS returns 404, HTTP returns 200 - should use HTTP
      mockRequest(https, 404)
      mockRequest(http, 200)
      
      const result = await probeForConnectAPI([1234])
      
      // HTTP 200 should be accepted
      expect(result).toEqual({
        baseUrl: 'http://localhost:1234',
        protocol: 'http',
        port: 1234
      })
    })
  })
})
