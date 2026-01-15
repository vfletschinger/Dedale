import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoadingScreen from '../../components/LoadingScreen'

describe('LoadingScreen Component', () => {
  describe('Rendu', () => {
    it('devrait afficher le logo Dedale', () => {
      render(<LoadingScreen />)
      
      const logo = screen.getByAltText('Dedale Logo')
      expect(logo).toBeInTheDocument()
      expect(logo).toHaveAttribute('src', '/dedale.png')
    })

    it('devrait avoir une structure de conteneur correcte', () => {
      const { container } = render(<LoadingScreen />)
      
      // Vérifier le conteneur principal avec fond dégradé
      const mainContainer = container.firstChild
      expect(mainContainer).toHaveClass('fixed', 'inset-0', 'z-50')
    })

    it('devrait afficher les indicateurs de chargement animés', () => {
      const { container } = render(<LoadingScreen />)
      
      // 3 points d'animation
      const dots = container.querySelectorAll('.animate-bounce')
      expect(dots.length).toBe(3)
    })

    it('devrait centrer le contenu', () => {
      const { container } = render(<LoadingScreen />)
      
      const mainContainer = container.firstChild
      expect(mainContainer).toHaveClass('flex', 'items-center', 'justify-center')
    })
  })

  describe('Accessibilité', () => {
    it('devrait avoir un alt text sur le logo', () => {
      render(<LoadingScreen />)
      
      const logo = screen.getByRole('img')
      expect(logo).toHaveAttribute('alt', 'Dedale Logo')
    })
  })

  describe('Styles', () => {
    it('devrait appliquer les classes responsives au logo', () => {
      render(<LoadingScreen />)
      
      const logo = screen.getByAltText('Dedale Logo')
      expect(logo).toHaveClass('w-32', 'h-32', 'md:w-48', 'md:h-48')
    })
  })
})
