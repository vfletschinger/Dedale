import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SelectableList, { SelectableItem } from '../../components/common/SelectableList'

interface TestItem extends SelectableItem {
  id: string
  name: string
}

describe('SelectableList Component', () => {
  const mockItems: TestItem[] = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    { id: '3', name: 'Item 3' },
    { id: '4', name: 'Item 4' }
  ]

  const defaultRenderItem = (item: TestItem, isSelected: boolean) => (
    <span data-testid={`item-${item.id}`} data-selected={isSelected}>
      {item.name}
    </span>
  )

  describe('Rendu Initial', () => {
    it('devrait afficher tous les items', () => {
      const onSelectionChange = vi.fn()
      render(
        <SelectableList
          items={mockItems}
          selectedIds={[]}
          onSelectionChange={onSelectionChange}
          renderItem={defaultRenderItem}
        />
      )
      
      expect(screen.getByTestId('item-1')).toBeInTheDocument()
      expect(screen.getByTestId('item-2')).toBeInTheDocument()
      expect(screen.getByTestId('item-3')).toBeInTheDocument()
      expect(screen.getByTestId('item-4')).toBeInTheDocument()
    })

    it('devrait afficher les items sélectionnés correctement', () => {
      const onSelectionChange = vi.fn()
      render(
        <SelectableList
          items={mockItems}
          selectedIds={['2', '3']}
          onSelectionChange={onSelectionChange}
          renderItem={defaultRenderItem}
        />
      )
      
      expect(screen.getByTestId('item-1')).toHaveAttribute('data-selected', 'false')
      expect(screen.getByTestId('item-2')).toHaveAttribute('data-selected', 'true')
      expect(screen.getByTestId('item-3')).toHaveAttribute('data-selected', 'true')
      expect(screen.getByTestId('item-4')).toHaveAttribute('data-selected', 'false')
    })

    it('devrait gérer une liste vide', () => {
      const onSelectionChange = vi.fn()
      const { container } = render(
        <SelectableList
          items={[]}
          selectedIds={[]}
          onSelectionChange={onSelectionChange}
          renderItem={defaultRenderItem}
        />
      )
      
      expect(container.querySelector('[data-testid]')).toBeNull()
    })
  })

  describe('Sélection Simple', () => {
    it('devrait sélectionner un item au clic', () => {
      const onSelectionChange = vi.fn()
      render(
        <SelectableList
          items={mockItems}
          selectedIds={[]}
          onSelectionChange={onSelectionChange}
          renderItem={defaultRenderItem}
        />
      )
      
      fireEvent.mouseDown(screen.getByText('Item 1'))
      
      expect(onSelectionChange).toHaveBeenCalledWith(['1'])
    })

    it('devrait désélectionner un item déjà sélectionné seul', () => {
      const onSelectionChange = vi.fn()
      render(
        <SelectableList
          items={mockItems}
          selectedIds={['1']}
          onSelectionChange={onSelectionChange}
          renderItem={defaultRenderItem}
        />
      )
      
      fireEvent.mouseDown(screen.getByText('Item 1'))
      
      expect(onSelectionChange).toHaveBeenCalledWith([])
    })

    it('devrait remplacer la sélection au clic simple', () => {
      const onSelectionChange = vi.fn()
      render(
        <SelectableList
          items={mockItems}
          selectedIds={['1', '2']}
          onSelectionChange={onSelectionChange}
          renderItem={defaultRenderItem}
        />
      )
      
      fireEvent.mouseDown(screen.getByText('Item 3'))
      
      expect(onSelectionChange).toHaveBeenCalledWith(['3'])
    })
  })

  describe('Sélection Multiple (Ctrl+Clic)', () => {
    it('devrait ajouter à la sélection avec Ctrl+Clic', () => {
      const onSelectionChange = vi.fn()
      render(
        <SelectableList
          items={mockItems}
          selectedIds={['1']}
          onSelectionChange={onSelectionChange}
          renderItem={defaultRenderItem}
        />
      )
      
      fireEvent.mouseDown(screen.getByText('Item 2'), { ctrlKey: true })
      
      expect(onSelectionChange).toHaveBeenCalledWith(['1', '2'])
    })

    it('devrait retirer de la sélection avec Ctrl+Clic sur un item sélectionné', () => {
      const onSelectionChange = vi.fn()
      render(
        <SelectableList
          items={mockItems}
          selectedIds={['1', '2', '3']}
          onSelectionChange={onSelectionChange}
          renderItem={defaultRenderItem}
        />
      )
      
      fireEvent.mouseDown(screen.getByText('Item 2'), { ctrlKey: true })
      
      expect(onSelectionChange).toHaveBeenCalledWith(['1', '3'])
    })
  })

  describe('Classes CSS', () => {
    it('devrait appliquer la classe de conteneur personnalisée', () => {
      const onSelectionChange = vi.fn()
      const { container } = render(
        <SelectableList
          items={mockItems}
          selectedIds={[]}
          onSelectionChange={onSelectionChange}
          renderItem={defaultRenderItem}
          containerClassName="custom-container"
        />
      )
      
      expect(container.firstChild).toHaveClass('custom-container')
    })
  })
})
