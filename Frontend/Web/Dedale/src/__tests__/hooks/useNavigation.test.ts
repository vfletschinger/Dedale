import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNavigation, PageKey } from '../../hooks/useNavigation'

describe('useNavigation Hook', () => {
  describe('État Initial', () => {
    it('devrait initialiser avec la page par défaut "event"', () => {
      const { result } = renderHook(() => useNavigation())
      
      expect(result.current.currentPage).toBe('event')
      expect(result.current.history).toEqual(['event'])
      expect(result.current.canGoBack).toBe(false)
    })

    it('devrait initialiser avec une page personnalisée', () => {
      const { result } = renderHook(() => useNavigation('map'))

      expect(result.current.currentPage).toBe('map')
      expect(result.current.history).toEqual(['map'])
    })

    it('devrait marquer la page initiale comme visitée', () => {
      const { result } = renderHook(() => useNavigation('team-person'))

      expect(result.current.hasVisited('team-person')).toBe(true)
      expect(result.current.hasVisited('event')).toBe(false)
    })
  })

  describe('Navigation', () => {
    it('devrait naviguer vers une nouvelle page', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate('map')
      })

      expect(result.current.currentPage).toBe('map')
      expect(result.current.history).toEqual(['event', 'map'])
    })

    it('devrait ne rien faire si on navigue vers la même page', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate('event')
      })

      expect(result.current.history).toEqual(['event'])
    })

    it('devrait marquer les pages visitées', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate('map')
        result.current.navigate('team-person')
      })

      expect(result.current.hasVisited('event')).toBe(true)
      expect(result.current.hasVisited('map')).toBe(true)
      expect(result.current.hasVisited('team-person')).toBe(true)
      expect(result.current.hasVisited('data')).toBe(false)
    })

    it('devrait construire un historique complet', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate('map')
        result.current.navigate('team-person')
        result.current.navigate('data')
      })

      expect(result.current.history).toEqual(['event', 'map', 'team-person', 'data'])
    })
  })

  describe('Retour Arrière', () => {
    it('devrait permettre le retour arrière après navigation', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate('map')
      })

      expect(result.current.canGoBack).toBe(true)
    })

    it('devrait revenir à la page précédente', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate('map')
        result.current.navigate('team-person')
        result.current.goBack()
      })

      expect(result.current.currentPage).toBe('map')
      expect(result.current.history).toEqual(['event', 'map'])
    })

    it('devrait ne rien faire si on est à la première page', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.goBack()
      })

      expect(result.current.currentPage).toBe('event')
      expect(result.current.history).toEqual(['event'])
    })

    it('devrait désactiver canGoBack à la première page', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate('map')
        result.current.goBack()
      })

      expect(result.current.canGoBack).toBe(false)
    })
  })

  describe('Reset', () => {
    it('devrait réinitialiser à la page par défaut', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate('map')
        result.current.navigate('team-person')
        result.current.reset()
      })

      expect(result.current.currentPage).toBe('event')
      expect(result.current.history).toEqual(['event'])
      expect(result.current.canGoBack).toBe(false)
    })

    it('devrait réinitialiser à une page personnalisée', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate('map')
        result.current.reset('planning')
      })

      expect(result.current.currentPage).toBe('planning')
      expect(result.current.history).toEqual(['planning'])
    })

    it('devrait réinitialiser les pages visitées', () => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate('map')
        result.current.navigate('team-person')
        result.current.reset('data')
      })

      expect(result.current.hasVisited('data')).toBe(true)
      expect(result.current.hasVisited('map')).toBe(false)
      expect(result.current.hasVisited('team-person')).toBe(false)
    })
  })

  describe('Toutes les Pages', () => {
    const allPages: PageKey[] = ['event', 'map', 'team-person', 'data', 'planning']

    it.each(allPages)('devrait pouvoir naviguer vers %s', (page) => {
      const { result } = renderHook(() => useNavigation())

      act(() => {
        result.current.navigate(page)
      })

      expect(result.current.currentPage).toBe(page)
    })
  })
})
