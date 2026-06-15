import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../__tests__/test-utils'
import EquipementForm from '../../components/EquipementForm'
import toast from 'react-hot-toast'

describe('EquipementForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()
  const mockInvoke = globalThis.mockInvoke as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'seed_default_equipment_types') return Promise.resolve()
      if (command === 'fetch_equipment_types') {
        return Promise.resolve([{ id: 'type-1', name: 'Barriere' }])
      }
      return Promise.resolve()
    })
  })

  it('suggests quantity based on line length and unit length', async () => {
    const { container, getAllByRole } = renderWithProviders(
      <EquipementForm lineLength={10} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    )

    await waitFor(() => {
      const select = container.querySelector('select') as HTMLSelectElement | null
      expect(select?.value).toBe('type-1')
    })

    const numberInputs = getAllByRole('spinbutton') as HTMLInputElement[]
    const quantityInput = numberInputs[1]

    await waitFor(() => {
      expect(quantityInput).toHaveValue(5)
    })
  })

  it('blocks submission when pose date is after depose date', async () => {
    const { container } = renderWithProviders(
      <EquipementForm lineLength={10} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
    )

    await waitFor(() => {
      const select = container.querySelector('select') as HTMLSelectElement | null
      expect(select?.value).toBe('type-1')
    })

    const dateInputs = container.querySelectorAll('input[type="datetime-local"]')
    const poseInput = dateInputs[0] as HTMLInputElement
    const deposeInput = dateInputs[1] as HTMLInputElement

    fireEvent.change(poseInput, { target: { value: '2026-05-23T10:00' } })
    fireEvent.change(deposeInput, { target: { value: '2026-05-23T09:00' } })

    await waitFor(() => {
      expect(poseInput.value).toBe('2026-05-23T10:00')
      expect(deposeInput.value).toBe('2026-05-23T09:00')
    })

    const form = container.querySelector('form') as HTMLFormElement
    expect(form).toBeTruthy()
    fireEvent.submit(form)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })
})
