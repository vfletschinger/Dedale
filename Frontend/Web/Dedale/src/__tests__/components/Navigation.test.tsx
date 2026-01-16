import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Navigation from '../../components/layout/Navigation'
import type { PageKey } from '../../hooks/useNavigation'

describe('Navigation Component', () => {
  const defaultProps = {
    currentPage: 'event' as PageKey,
    onNavigate: vi.fn(),
    eventSelected: false,
    deselectEvent: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendu Initial', () => {
    it('devrait afficher le logo et le titre Dedale', () => {
      render(<Navigation {...defaultProps} />)
      expect(screen.getByAltText('Logo')).toBeInTheDocument()
      expect(screen.getByText('Dedale')).toBeInTheDocument()
    })

    it('devrait afficher tous les onglets de navigation', () => {
      render(<Navigation {...defaultProps} />)

      expect(screen.getByText('Événements')).toBeInTheDocument()
      expect(screen.getByText('Carte')).toBeInTheDocument()
      expect(screen.getByText('Équipes')).toBeInTheDocument()
      expect(screen.getByText('Planning')).toBeInTheDocument()
      expect(screen.getByText('Données')).toBeInTheDocument()
    })

    it('devrait afficher le bouton de sélection d\'événement quand aucun n\'est sélectionné', () => {
      render(<Navigation {...defaultProps} eventSelected={false} />)

      expect(screen.getByText('Sélectionner un événement')).toBeInTheDocument()
    })
  })

  describe('État Événement Sélectionné', () => {
    it('devrait afficher le nom de l\'événement quand sélectionné', () => {
      render(
        <Navigation
          {...defaultProps}
          eventSelected={true}
          eventName="Festival 2024"
        />
      )

      expect(screen.getByText('Festival 2024')).toBeInTheDocument()
    })

    it('devrait afficher "Événement" par défaut si pas de nom', () => {
      render(<Navigation {...defaultProps} eventSelected={true} />)

      expect(screen.getByText('Événement')).toBeInTheDocument()
    })

    it('devrait avoir un bouton de désélection', () => {
      render(<Navigation {...defaultProps} eventSelected={true} />)

      const deselectButton = screen.getByTitle('Désélectionner l\'événement')
      expect(deselectButton).toBeInTheDocument()
    })

    it('devrait appeler deselectEvent au clic sur le bouton de désélection', () => {
      const deselectEvent = vi.fn()
      render(
        <Navigation
          {...defaultProps}
          eventSelected={true}
          deselectEvent={deselectEvent}
        />
      )

      fireEvent.click(screen.getByTitle('Désélectionner l\'événement'))

      expect(deselectEvent).toHaveBeenCalled()
    })
  })

  describe('Navigation entre Pages', () => {
    it('devrait appeler onNavigate au clic sur un onglet', () => {
      const onNavigate = vi.fn()
      render(
        <Navigation
          {...defaultProps}
          onNavigate={onNavigate}
          eventSelected={true}
        />
      )

      fireEvent.click(screen.getByText('Carte'))

      expect(onNavigate).toHaveBeenCalledWith('map')
    })

    it('devrait naviguer vers event au clic sur le logo', () => {
      const onNavigate = vi.fn()
      render(
        <Navigation
          {...defaultProps}
          onNavigate={onNavigate}
          currentPage="map"
        />
      )

      fireEvent.click(screen.getByText('Dedale'))

      expect(onNavigate).toHaveBeenCalledWith('event')
    })
  })

  describe('Onglets Désactivés', () => {
    it('devrait désactiver les onglets quand aucun événement n\'est sélectionné', () => {
      render(<Navigation {...defaultProps} eventSelected={false} />)

      expect(screen.getByText('Carte')).toBeDisabled()
      expect(screen.getByText('Équipes')).toBeDisabled()
      expect(screen.getByText('Planning')).toBeDisabled()
      expect(screen.getByText('Données')).toBeDisabled()
    })

    it('devrait garder l\'onglet Événements actif sans sélection', () => {
      render(<Navigation {...defaultProps} eventSelected={false} />)

      expect(screen.getByText('Événements')).not.toBeDisabled()
    })

    it('devrait activer tous les onglets quand un événement est sélectionné', () => {
      render(<Navigation {...defaultProps} eventSelected={true} />)

      expect(screen.getByText('Carte')).not.toBeDisabled()
      expect(screen.getByText('Équipes')).not.toBeDisabled()
      expect(screen.getByText('Planning')).not.toBeDisabled()
      expect(screen.getByText('Données')).not.toBeDisabled()
    })
  })

  describe('Page Active', () => {
    it('devrait marquer la page courante comme active', () => {
      render(<Navigation {...defaultProps} currentPage="event" />)

      const eventButton = screen.getByText('Événements')
      expect(eventButton).toHaveClass('text-secondary')
    })

    it('devrait changer le style pour les pages non actives', () => {
      render(<Navigation {...defaultProps} currentPage="map" eventSelected={true} />)

      const eventButton = screen.getByText('Événements')
      expect(eventButton).toHaveClass('text-gray-300')
    })
  })
})
