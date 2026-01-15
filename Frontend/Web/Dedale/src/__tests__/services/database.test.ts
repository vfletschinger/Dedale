import { describe, it, expect, vi, beforeEach } from 'vitest'

// Direct mock setup for this file
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

import * as database from '../../services/database'
import { invoke } from '@tauri-apps/api/core'

// Cast to mock for proper typing
const mockInvoke = invoke as ReturnType<typeof vi.fn>

describe('Database Service', () => {
  beforeEach(() => {
    mockInvoke.mockClear()
  })

  describe('Person Management', () => {
    describe('getAllPersons', () => {
      it('should fetch all persons', async () => {
        const mockPersons = [
          { id: 1, name: 'John Doe', email: 'john@test.com', role: 'admin' },
          { id: 2, name: 'Jane Smith', email: 'jane@test.com', role: 'user' }
        ]
        mockInvoke.mockResolvedValue(mockPersons)

        const result = await database.getAllPersons()

        expect(mockInvoke).toHaveBeenCalledWith('get_all_persons')
        expect(result).toEqual(mockPersons)
      })

      it('should handle errors when fetching persons', async () => {
        const error = new Error('Database error')
        mockInvoke.mockRejectedValue(error)

        await expect(database.getAllPersons()).rejects.toThrow('Failed to fetch persons')
      })

      it('should return empty array when no persons exist', async () => {
        mockInvoke.mockResolvedValue([])

        const result = await database.getAllPersons()

        expect(result).toEqual([])
        expect(mockInvoke).toHaveBeenCalledWith('get_all_persons')
      })
    })

    describe('getPersonById', () => {
      it('should fetch person by ID', async () => {
        const mockPerson = { id: 1, name: 'John Doe', email: 'john@test.com', role: 'admin' }
        mockInvoke.mockResolvedValue(mockPerson)

        const result = await database.getPersonById(1)

        expect(mockInvoke).toHaveBeenCalledWith('get_person_by_id', { id: 1 })
        expect(result).toEqual(mockPerson)
      })

      it('should handle errors when fetching person by ID', async () => {
        const error = new Error('Person not found')
        mockInvoke.mockRejectedValue(error)

        await expect(database.getPersonById(1)).rejects.toThrow('Person not found')
      })

      it('should validate person ID', async () => {
        await expect(database.getPersonById(0)).rejects.toThrow('Person ID must be positive')
        await expect(database.getPersonById(-1)).rejects.toThrow('Person ID must be positive')
      })
    })

    describe('createPerson', () => {
      it('should create a new person', async () => {
        const newPerson = {
          name: 'John Doe',
          email: 'john@test.com',
          role: 'admin'
        }
        mockInvoke.mockResolvedValue(3)

        const result = await database.createPerson(newPerson)

        expect(mockInvoke).toHaveBeenCalledWith('create_person', newPerson)
        expect(result).toBe(3)
      })

      it('should validate email format', async () => {
        const invalidPerson = {
          name: 'John Doe',
          email: 'invalid-email',
          role: 'admin'
        }

        await expect(database.createPerson(invalidPerson)).rejects.toThrow('Invalid email format')
      })

      it('should validate role', async () => {
        const invalidPerson = {
          name: 'John Doe',
          email: 'john@test.com',
          role: 'invalid-role'
        }

        await expect(database.createPerson(invalidPerson)).rejects.toThrow('Invalid role')
      })

      it('should validate required fields', async () => {
        const incompletePerson = {
          name: '',
          email: 'john@test.com',
          role: 'admin'
        }

        await expect(database.createPerson(incompletePerson)).rejects.toThrow('Name is required')
      })
    })

    describe('updatePerson', () => {
      it('should update an existing person', async () => {
        const updatedPerson = {
          id: 1,
          name: 'John Updated',
          email: 'john.updated@test.com',
          role: 'admin'
        }
        mockInvoke.mockResolvedValue(undefined)

        await database.updatePerson(1, updatedPerson)

        expect(mockInvoke).toHaveBeenCalledWith('update_person', {
          id: 1,
          name: 'John Updated',
          email: 'john.updated@test.com',
          role: 'admin'
        })
      })

      it('should validate person ID for updates', async () => {
        const person = { name: 'Test', email: 'test@test.com', role: 'admin' }
        await expect(database.updatePerson(0, person)).rejects.toThrow('Person ID must be positive')
      })
    })

    describe('deletePerson', () => {
      it('should delete a person', async () => {
        mockInvoke.mockResolvedValue(undefined)

        await database.deletePerson(1)

        expect(mockInvoke).toHaveBeenCalledWith('delete_person', { id: 1 })
      })

      it('should validate person ID for deletion', async () => {
        await expect(database.deletePerson(0)).rejects.toThrow('Person ID must be positive')
      })

      it('should handle deletion errors', async () => {
        const error = new Error('Person not found')
        mockInvoke.mockRejectedValue(error)

        await expect(database.deletePerson(1)).rejects.toThrow('Person has associated records')
      })
    })
  })
})