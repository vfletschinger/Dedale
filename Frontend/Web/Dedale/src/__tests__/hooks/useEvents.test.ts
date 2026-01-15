import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the service module
vi.mock('../../services/eventService', () => ({
  fetchEvents: vi.fn(),
  fetchEventById: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  createEventGeometry: vi.fn(),
  updateEventGeometry: vi.fn(),
  deleteEventGeometry: vi.fn()
}))

import { useEvents } from '../../hooks/useEvents'
import * as eventService from '../../services/eventService'

const mockFetchEvents = eventService.fetchEvents as ReturnType<typeof vi.fn>
const mockFetchEventById = eventService.fetchEventById as ReturnType<typeof vi.fn>
const mockCreateEvent = eventService.createEvent as ReturnType<typeof vi.fn>
const mockUpdateEvent = eventService.updateEvent as ReturnType<typeof vi.fn>
const mockDeleteEvent = eventService.deleteEvent as ReturnType<typeof vi.fn>

const mockEvents = [
  { id: '1', name: 'Event 1', start_date: '2024-01-01', end_date: '2024-01-31', statut: 'actif', geometries: [] },
  { id: '2', name: 'Event 2', start_date: '2024-02-01', end_date: '2024-02-28', statut: 'planifie', geometries: [] }
]

describe('useEvents Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchEvents.mockResolvedValue(mockEvents)
    mockFetchEventById.mockResolvedValue(mockEvents[0])
  })

  describe('État Initial', () => {
    it('devrait initialiser avec une liste vide', () => {
      const { result } = renderHook(() => useEvents())
      
      expect(result.current.events).toEqual([])
      expect(result.current.selectedEvent).toBeNull()
      expect(result.current.error).toBeNull()
    })

it('devrait avoir un état de chargement défini', () => {
      const { result } = renderHook(() => useEvents())

      expect(result.current.isLoading).toBeDefined()
    })

    it('devrait exposer toutes les fonctions nécessaires', () => {
      const { result } = renderHook(() => useEvents())
      
      expect(typeof result.current.loadEvents).toBe('function')
      expect(typeof result.current.selectEvent).toBe('function')
      expect(typeof result.current.addEvent).toBe('function')
      expect(typeof result.current.editEvent).toBe('function')
      expect(typeof result.current.removeEvent).toBe('function')
      expect(typeof result.current.clearError).toBe('function')
      expect(typeof result.current.clearSelection).toBe('function')
    })
  })

  describe('loadEvents', () => {
    it('devrait charger les événements avec succès', async () => {
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.loadEvents()
      })
      
      expect(mockFetchEvents).toHaveBeenCalled()
      expect(result.current.events).toEqual(mockEvents)
      expect(result.current.isLoading).toBe(false)
    })

    it('devrait définir isLoading pendant le chargement', async () => {
      const { result } = renderHook(() => useEvents())
      
      let loadingDuringFetch = false
      mockFetchEvents.mockImplementation(() => {
        loadingDuringFetch = result.current.isLoading
        return Promise.resolve(mockEvents)
      })
      
      await act(async () => {
        await result.current.loadEvents()
      })
      
      expect(loadingDuringFetch).toBe(true)
      expect(result.current.isLoading).toBe(false)
    })

    it('devrait gérer les erreurs de chargement', async () => {
      mockFetchEvents.mockRejectedValue(new Error('Network error'))
      
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.loadEvents()
      })
      
      expect(result.current.error).toBe('Network error')
      expect(result.current.events).toEqual([])
    })
  })

  describe('selectEvent', () => {
    it('devrait sélectionner un événement par ID', async () => {
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.selectEvent('1')
      })
      
      expect(mockFetchEventById).toHaveBeenCalledWith('1')
      expect(result.current.selectedEvent).toEqual(mockEvents[0])
    })

    it('devrait gérer les erreurs de sélection', async () => {
      mockFetchEventById.mockRejectedValue(new Error('Not found'))
      
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.selectEvent('999')
      })
      
      expect(result.current.error).toBe('Not found')
    })
  })

  describe('addEvent', () => {
    it('devrait ajouter un événement avec succès', async () => {
      const newEvent = { name: 'New Event', start_date: '2024-03-01', end_date: '2024-03-31', statut: 'planifie' }
      mockCreateEvent.mockResolvedValue('new-id')
      mockFetchEventById.mockResolvedValue({ id: 'new-id', ...newEvent, geometries: [] })
      
      const { result } = renderHook(() => useEvents())
      
      let createdEvent
      await act(async () => {
        createdEvent = await result.current.addEvent(newEvent)
      })
      
      expect(mockCreateEvent).toHaveBeenCalledWith(newEvent)
      expect(createdEvent).toBeDefined()
    })

    it('devrait recharger les événements après ajout', async () => {
      const newEvent = { name: 'New Event', date_debut: '2024-03-01', date_fin: '2024-03-31', statut: 'planifie' }
      mockCreateEvent.mockResolvedValue('new-id')
      
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.addEvent(newEvent)
      })
      
      expect(mockFetchEvents).toHaveBeenCalled()
    })

    it('devrait gérer les erreurs d\'ajout', async () => {
      mockCreateEvent.mockRejectedValue(new Error('Creation failed'))
      
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        const created = await result.current.addEvent({ name: '', date_debut: '', date_fin: '', statut: '' })
        expect(created).toBeNull()
      })
      
      expect(result.current.error).toBe('Creation failed')
    })
  })

  describe('editEvent', () => {
    it('devrait modifier un événement avec succès', async () => {
      const updatedData = { name: 'Updated Event', date_debut: '2024-03-01', date_fin: '2024-03-31', statut: 'actif' }
      mockUpdateEvent.mockResolvedValue(undefined)
      
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.editEvent('1', updatedData)
      })
      
      expect(mockUpdateEvent).toHaveBeenCalledWith('1', updatedData)
    })

    it('devrait recharger les événements après modification', async () => {
      mockUpdateEvent.mockResolvedValue(undefined)
      
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.editEvent('1', { name: 'Updated', date_debut: '', date_fin: '', statut: '' })
      })
      
      expect(mockFetchEvents).toHaveBeenCalled()
    })
  })

  describe('removeEvent', () => {
    it('devrait supprimer un événement avec succès', async () => {
      mockDeleteEvent.mockResolvedValue(undefined)
      
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.removeEvent('1')
      })
      
      expect(mockDeleteEvent).toHaveBeenCalledWith('1')
    })

    it('devrait recharger les événements après suppression', async () => {
      mockDeleteEvent.mockResolvedValue(undefined)
      
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.removeEvent('1')
      })
      
      expect(mockFetchEvents).toHaveBeenCalled()
    })

    it('devrait désélectionner si l\'événement supprimé était sélectionné', async () => {
      mockDeleteEvent.mockResolvedValue(undefined)
      
      const { result } = renderHook(() => useEvents())
      
      // Sélectionner d'abord
      await act(async () => {
        await result.current.selectEvent('1')
      })
      
      expect(result.current.selectedEvent).not.toBeNull()
      
      // Puis supprimer
      await act(async () => {
        await result.current.removeEvent('1')
      })
      
      expect(result.current.selectedEvent).toBeNull()
    })
  })

  describe('clearError', () => {
    it('devrait effacer l\'erreur', async () => {
      mockFetchEvents.mockRejectedValue(new Error('Test error'))
      
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.loadEvents()
      })
      
      expect(result.current.error).toBe('Test error')
      
      act(() => {
        result.current.clearError()
      })
      
      expect(result.current.error).toBeNull()
    })
  })

  describe('clearSelection', () => {
    it('devrait désélectionner l\'événement', async () => {
      const { result } = renderHook(() => useEvents())
      
      await act(async () => {
        await result.current.selectEvent('1')
      })
      
      expect(result.current.selectedEvent).not.toBeNull()
      
      act(() => {
        result.current.clearSelection()
      })
      
      expect(result.current.selectedEvent).toBeNull()
    })
  })
})
