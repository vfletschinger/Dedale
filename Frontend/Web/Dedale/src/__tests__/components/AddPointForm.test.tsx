import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithProviders, screen, fireEvent, waitFor, createMockInvoke } from '../../__tests__/test-utils'
import AddPointForm from '../../components/AddPointForm'

// Mock Tauri invoke
const mockInvoke = createMockInvoke()
vi.mocked(await import('@tauri-apps/api/core')).invoke = mockInvoke

describe('AddPointForm', () => {
  const defaultProps = {
    initialCoords: { lng: 7.7521, lat: 48.5734 },
    eventId: 'test-event',
    onClose: vi.fn(),
    onSaved: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render form with all required fields', () => {
      renderWithProviders(<AddPointForm {...defaultProps} />)

      expect(screen.getByText('Nouveau point')).toBeInTheDocument()
      expect(screen.getByText('Créer un nouveau point d\'intérêt')).toBeInTheDocument()
      expect(screen.getByLabelText(/nom du point/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/commentaire/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /ajouter le point/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument()
    })

    it('should load point count and set default name', async () => {
      mockInvoke.mockResolvedValueOnce([{ id: '1' }, { id: '2' }]) // 2 existing points

      renderWithProviders(<AddPointForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Point 3')).toBeInTheDocument()
      })

      expect(mockInvoke).toHaveBeenCalledWith('fetch_points', { eventId: 'test-event' })
    })

    it('should default to Point 1 when no existing points', async () => {
      mockInvoke.mockResolvedValueOnce([]) // No existing points

      renderWithProviders(<AddPointForm {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Point 1')).toBeInTheDocument()
      })
    })
  })

  describe('Form Interaction', () => {
    it('should update name field', async () => {
      renderWithProviders(<AddPointForm {...defaultProps} />)

      const nameInput = screen.getByLabelText(/nom du point/i)
      fireEvent.change(nameInput, { target: { value: 'Custom Point' } })

      expect(nameInput).toHaveValue('Custom Point')
    })



    it('should update type field', async () => {
      renderWithProviders(<AddPointForm {...defaultProps} />)

      const typeSelect = screen.getByLabelText(/type/i)
      fireEvent.change(typeSelect, { target: { value: 'danger' } })

      expect(typeSelect).toHaveValue('danger')
    })

    it('should toggle status checkbox', async () => {
      renderWithProviders(<AddPointForm {...defaultProps} />)

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(checkbox).toBeChecked()
    })

    it('should update comment field', async () => {
      renderWithProviders(<AddPointForm {...defaultProps} />)

      const commentTextarea = screen.getByLabelText(/commentaire/i)
      fireEvent.change(commentTextarea, { target: { value: 'Test comment' } })

      expect(commentTextarea).toHaveValue('Test comment')
    })
  })

  describe('Form Submission', () => {
    it('should save point with correct data', async () => {
      mockInvoke.mockResolvedValueOnce(['new-point-id'])

      renderWithProviders(<AddPointForm {...defaultProps} />)

      // Wait for default name to load
      await waitFor(() => screen.getByDisplayValue('Point 1'))

      // Fill form
      const nameInput = screen.getByLabelText(/nom du point/i)
      const typeSelect = screen.getByLabelText(/type/i)
      const commentTextarea = screen.getByLabelText(/commentaire/i)
      const checkbox = screen.getByRole('checkbox')

      fireEvent.change(nameInput, { target: { value: 'Test Point' } })
      fireEvent.change(typeSelect, { target: { value: 'danger' } })
      fireEvent.change(commentTextarea, { target: { value: 'Test comment' } })
      fireEvent.click(checkbox)

      // Submit form
      const saveButton = screen.getByRole('button', { name: /ajouter le point/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('insert_point', {
          point: {
            id: '',
            event_id: 'test-event',
            x: 7.7521,
            y: 48.5734,
            name: 'Test Point',
            comment: 'Test comment',
            type: 'danger',
            status: true
          }
        })
      })

      expect(defaultProps.onSaved).toHaveBeenCalled()
      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('should show error when no eventId provided', async () => {
      const propsWithoutEventId = { ...defaultProps, eventId: null }
      renderWithProviders(<AddPointForm {...propsWithoutEventId} />)

      const saveButton = screen.getByRole('button', { name: /ajouter le point/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockInvoke).not.toHaveBeenCalledWith('insert_point', expect.anything())
      })
    })

    it('should handle save errors gracefully', async () => {
      const error = new Error('Save failed')
      mockInvoke.mockRejectedValueOnce(error)

      renderWithProviders(<AddPointForm {...defaultProps} />)

      await waitFor(() => screen.getByDisplayValue('Point 1'))

      const saveButton = screen.getByRole('button', { name: /ajouter le point/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(defaultProps.onSaved).not.toHaveBeenCalled()
        expect(defaultProps.onClose).not.toHaveBeenCalled()
      })
    })

    it('should show loading state during save', async () => {
      let resolvePromise: (value: string[]) => void
      const savePromise = new Promise<string[]>(resolve => {
        resolvePromise = resolve
      })
      mockInvoke.mockReturnValueOnce(savePromise)

      renderWithProviders(<AddPointForm {...defaultProps} />)

      await waitFor(() => screen.getByDisplayValue('Point 1'))

      const saveButton = screen.getByRole('button', { name: /ajouter le point/i })
      fireEvent.click(saveButton)

      expect(screen.getByText('Enregistrement...')).toBeInTheDocument()

      resolvePromise!(['new-point-id'])

      await waitFor(() => {
        expect(screen.queryByText('Enregistrement...')).not.toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    it('should handle empty name gracefully', async () => {
      renderWithProviders(<AddPointForm {...defaultProps} />)

      await waitFor(() => screen.getByDisplayValue('Point 1'))

      const nameInput = screen.getByLabelText(/nom du point/i)
      fireEvent.change(nameInput, { target: { value: '' } })

      const saveButton = screen.getByRole('button', { name: /ajouter le point/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('insert_point',
          expect.objectContaining({
            point: expect.objectContaining({
              name: null
            })
          })
        )
      })
    })
  })

  describe('Event Handlers', () => {
    it('should call onClose when cancel button clicked', () => {
      renderWithProviders(<AddPointForm {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /annuler/i })
      fireEvent.click(cancelButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('should call onClose when X button clicked', () => {
      renderWithProviders(<AddPointForm {...defaultProps} />)

      const closeButton = screen.getByText('✕')
      fireEvent.click(closeButton)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })
})