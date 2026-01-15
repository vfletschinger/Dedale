import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../__tests__/test-utils'
import AdminForm from '../../components/AdminForm'

describe('AdminForm Component', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render form with username and password fields', () => {
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      expect(screen.getByText("Nom d'utilisateur")).toBeInTheDocument()
      expect(screen.getByText("Mot de passe")).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /créer l'administrateur/i })).toBeInTheDocument()
    })

    it('should render username input field', () => {
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const usernameInput = screen.getByRole('textbox')
      expect(usernameInput).toBeInTheDocument()
      expect(usernameInput).toHaveAttribute('type', 'text')
    })

    it('should render password input field', () => {
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const passwordInput = document.querySelector('input[type="password"]')
      expect(passwordInput).toBeInTheDocument()
    })
  })

  describe('Form Interactions', () => {
    it('should update username field on input', () => {
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const usernameInput = screen.getByRole('textbox')
      
      fireEvent.change(usernameInput, { target: { value: 'testadmin' } })
      
      expect(usernameInput).toHaveValue('testadmin')
    })

    it('should update password field on input', () => {
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      
      fireEvent.change(passwordInput, { target: { value: 'secret123' } })
      
      expect(passwordInput).toHaveValue('secret123')
    })
  })

  describe('Form Validation', () => {
    it('should show error when submitting empty form', async () => {
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const submitButton = screen.getByRole('button', { name: /créer l'administrateur/i })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/veuillez fournir un nom d'utilisateur et un mot de passe/i)).toBeInTheDocument()
      })
      
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should show error when only username is provided', async () => {
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const usernameInput = screen.getByRole('textbox')
      fireEvent.change(usernameInput, { target: { value: 'admin' } })
      
      const submitButton = screen.getByRole('button', { name: /créer l'administrateur/i })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/veuillez fournir un nom d'utilisateur et un mot de passe/i)).toBeInTheDocument()
      })
      
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('should show error when only password is provided', async () => {
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      fireEvent.change(passwordInput, { target: { value: 'password' } })
      
      const submitButton = screen.getByRole('button', { name: /créer l'administrateur/i })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/veuillez fournir un nom d'utilisateur et un mot de passe/i)).toBeInTheDocument()
      })
      
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Form Submission', () => {
    it('should call onSubmit with username and password', async () => {
      mockOnSubmit.mockResolvedValue(undefined)
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const usernameInput = screen.getByRole('textbox')
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      
      fireEvent.change(usernameInput, { target: { value: 'newadmin' } })
      fireEvent.change(passwordInput, { target: { value: 'securepassword' } })
      
      const submitButton = screen.getByRole('button', { name: /créer l'administrateur/i })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('newadmin', 'securepassword')
      })
    })

    it('should show loading state during submission', async () => {
      let resolvePromise: () => void
      const promise = new Promise<void>(resolve => {
        resolvePromise = resolve
      })
      mockOnSubmit.mockReturnValue(promise)
      
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const usernameInput = screen.getByRole('textbox')
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      
      fireEvent.change(usernameInput, { target: { value: 'admin' } })
      fireEvent.change(passwordInput, { target: { value: 'password' } })
      
      const submitButton = screen.getByRole('button', { name: /créer l'administrateur/i })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Création...')).toBeInTheDocument()
      })
      
      expect(submitButton).toBeDisabled()
      
      resolvePromise!()
      
      await waitFor(() => {
        expect(screen.getByText("Créer l'administrateur")).toBeInTheDocument()
      })
    })

    it('should handle submission error', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Creation failed'))
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const usernameInput = screen.getByRole('textbox')
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      
      fireEvent.change(usernameInput, { target: { value: 'admin' } })
      fireEvent.change(passwordInput, { target: { value: 'password' } })
      
      const submitButton = screen.getByRole('button', { name: /créer l'administrateur/i })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Creation failed')).toBeInTheDocument()
      })
    })

    it('should handle non-Error rejection', async () => {
      mockOnSubmit.mockRejectedValue('String error')
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const usernameInput = screen.getByRole('textbox')
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      
      fireEvent.change(usernameInput, { target: { value: 'admin' } })
      fireEvent.change(passwordInput, { target: { value: 'password' } })
      
      const submitButton = screen.getByRole('button', { name: /créer l'administrateur/i })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('String error')).toBeInTheDocument()
      })
    })
  })

  describe('Button State', () => {
    it('should enable submit button by default', () => {
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const submitButton = screen.getByRole('button', { name: /créer l'administrateur/i })
      expect(submitButton).not.toBeDisabled()
    })

    it('should disable submit button during loading', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(() => {})) // Never resolves
      renderWithProviders(<AdminForm onSubmit={mockOnSubmit} />)
      
      const usernameInput = screen.getByRole('textbox')
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
      
      fireEvent.change(usernameInput, { target: { value: 'admin' } })
      fireEvent.change(passwordInput, { target: { value: 'password' } })
      
      const submitButton = screen.getByRole('button', { name: /créer l'administrateur/i })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })
    })
  })
})