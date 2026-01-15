import '@testing-library/jest-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Create and expose mock globally
const mockInvoke = vi.fn()

// Expose mock globally for tests
declare global {
  var mockInvoke: ReturnType<typeof vi.fn>
}

globalThis.mockInvoke = mockInvoke

// Mock URL.createObjectURL at top level (before any imports)
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
globalThis.URL.revokeObjectURL = vi.fn()

// Mock Tauri API with the global reference
vi.mock('@tauri-apps/api/core', () => ({
  invoke: globalThis.mockInvoke
}))

// Mock window.URL.createObjectURL for map tests
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
  globalThis.mockInvoke.mockReset()
})

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => { })
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn()
  },
  Toaster: vi.fn(() => 'div')
}))

// Mock FontAwesome
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: vi.fn(() =>
    'i'
  )
}))

// runs a cleanup after each test case
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})