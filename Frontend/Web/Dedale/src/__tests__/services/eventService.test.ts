import { describe, it, expect, vi, beforeEach } from 'vitest'

// Direct mock setup for this file
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

import {
  fetchEvents,
  fetchEventById,
  createEvent,
  updateEvent,
  deleteEvent
} from '../../services/eventService'
import { invoke } from '@tauri-apps/api/core'

const mockInvoke = invoke as ReturnType<typeof vi.fn>

describe('EventService', () => {
  beforeEach(() => {
    mockInvoke.mockClear()
  })

  describe('fetchEvents', () => {
    it('devrait récupérer tous les événements', async () => {
      const mockEvents = [
        { id: '1', name: 'Event 1', start_date: '2024-01-01', end_date: '2024-01-31', statut: 'actif' },
        { id: '2', name: 'Event 2', start_date: '2024-02-01', end_date: '2024-02-28', statut: 'planifie' }
      ]
      mockInvoke.mockResolvedValue(mockEvents)

      const result = await fetchEvents()

      expect(mockInvoke).toHaveBeenCalledWith('fetch_events')
      expect(result).toEqual(mockEvents)
    })

    it('devrait gérer les erreurs de récupération', async () => {
      const error = new Error('Network error')
      mockInvoke.mockRejectedValue(error)

      await expect(fetchEvents()).rejects.toThrow('Impossible de récupérer les événements')
    })

    it('devrait retourner un tableau vide si aucun événement', async () => {
      mockInvoke.mockResolvedValue([])

      const result = await fetchEvents()

      expect(result).toEqual([])
    })
  })

  describe('fetchEventById', () => {
    it('devrait récupérer un événement par son ID', async () => {
      const mockEvent = { id: '1', name: 'Event 1', start_date: '2024-01-01', end_date: '2024-01-31', statut: 'actif' }
      mockInvoke.mockResolvedValue(mockEvent)

      const result = await fetchEventById('1')

      expect(mockInvoke).toHaveBeenCalledWith('fetch_event_by_id', { eventId: '1' })
      expect(result).toEqual(mockEvent)
    })

    it('devrait gérer un événement non trouvé', async () => {
      mockInvoke.mockResolvedValue(null)

      const result = await fetchEventById('999')

      expect(result).toBeNull()
    })

    it('devrait gérer les erreurs de récupération par ID', async () => {
      const error = new Error('Not found')
      mockInvoke.mockRejectedValue(error)

      await expect(fetchEventById('1')).rejects.toThrow('Impossible de récupérer l\'événement')
    })
  })

  describe('createEvent', () => {
    it('devrait créer un nouvel événement', async () => {
      const newEvent = {
        name: 'New Event',
        start_date: '2024-03-01',
        end_date: '2024-03-31',
        statut: 'planifie'
      }
      mockInvoke.mockResolvedValue('new-event-id')

      const result = await createEvent(newEvent)

      expect(mockInvoke).toHaveBeenCalledWith('create_event', { event: newEvent })
      expect(result).toBe('new-event-id')
    })

    it('devrait gérer les erreurs de création', async () => {
      const error = new Error('Validation failed')
      mockInvoke.mockRejectedValue(error)

      await expect(createEvent({ name: '', date_debut: '', date_fin: '', statut: '' })).rejects.toThrow('Impossible de créer l\'événement')
    })
  })

  describe('updateEvent', () => {
    it('devrait mettre à jour un événement', async () => {
      const updatedEvent = {
        name: 'Updated Event',
        start_date: '2024-03-01',
        end_date: '2024-03-31',
        statut: 'actif'
      }
      mockInvoke.mockResolvedValue(undefined)

      await updateEvent('1', updatedEvent)

      expect(mockInvoke).toHaveBeenCalledWith('update_event', { eventId: '1', event: updatedEvent })
    })

    it('devrait gérer les erreurs de mise à jour', async () => {
      const error = new Error('Update failed')
      mockInvoke.mockRejectedValue(error)

      await expect(updateEvent('1', { name: 'Test', date_debut: '', date_fin: '', statut: '' })).rejects.toThrow('Impossible de mettre à jour l\'événement')
    })
  })

  describe('deleteEvent', () => {
    it('devrait supprimer un événement', async () => {
      mockInvoke.mockResolvedValue(undefined)

      await deleteEvent('1')

      expect(mockInvoke).toHaveBeenCalledWith('delete_event', { eventId: '1' })
    })

    it('devrait gérer les erreurs de suppression', async () => {
      const error = new Error('Delete failed')
      mockInvoke.mockRejectedValue(error)

      await expect(deleteEvent('1')).rejects.toThrow('Impossible de supprimer l\'événement')
    })
  })

 
})
