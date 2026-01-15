import { render } from '@testing-library/react'
import { ReactElement } from 'react'
import { vi } from 'vitest'
import { Toaster } from 'react-hot-toast'

// Custom render function with providers
export function renderWithProviders(ui: ReactElement) {
  return render(
    <>
      {ui}
      <Toaster />
    </>
  )
}

// Mock utilities
export const mockEvent = (id: string = '1', name: string = 'Test Event') => ({
  id,
  name,
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  statut: 'actif',
  geometries: []
})

export const mockPoint = (id: string = '1', name: string = 'Test Point') => ({
  id,
  event_id: 'event-1',
  x: 7.7521,
  y: 48.5734,
  name,
  comment: null,
  type: 'info',
  status: false
})

export const mockEquipment = (id: string = '1', nom: string = 'Test Equipment') => ({
  id,
  nom,
  type: 'Materiel',
  statut: 'Disponible',
  quantite: 1
})

export const mockGeometry = (id: string = '1') => ({
  id,
  event_id: 'event-1',
  geometry_type: 'polygon',
  coordinates: [[7.7521, 48.5734]],
  properties: {}
})

export const createMockInvoke = () => {
  const mockInvoke = vi.fn()
  
  // Default implementations
  mockInvoke.mockImplementation((command) => {
    switch (command) {
      case 'fetch_events':
        return Promise.resolve([mockEvent()])
      case 'fetch_points':
        return Promise.resolve([mockPoint()])
      case 'create_event':
        return Promise.resolve('new-event-id')
      case 'insert_point':
        return Promise.resolve(['new-point-id'])
      case 'fetch_equipements':
        return Promise.resolve([mockEquipment()])
      default:
        return Promise.resolve()
    }
  })
  
  return mockInvoke
}

// Re-export everything from @testing-library/react
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'