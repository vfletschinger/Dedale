import * as databaseAccess from '../../services/databaseAcces';
import { generateUUID } from '../../services/Helper';

// Mock de la fonction Helper pour contrôler les IDs générés
jest.mock('../../services/Helper', () => ({
  generateUUID: jest.fn(),
}));

describe('Service: databaseAcces', () => {
  let mockDb: any;

  beforeEach(() => {
    // Arrange
    mockDb = {
      runSync: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('Comment Functions', () => {
    test('updateComment should execute correct SQL', () => {
      // Arrange
      const pointId = 'point-123';
      const newValue = 'Nouveau commentaire';

      // Act
      databaseAccess.updateComment(pointId, newValue, mockDb);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'UPDATE point SET comment = ? WHERE id = ?',
        [newValue, pointId]
      );
    });

    test('deleteComment should set comment to NULL', () => {
      // Arrange
      const pointId = 'point-123';

      // Act
      databaseAccess.deleteComment(pointId, mockDb);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'UPDATE point SET comment = NULL WHERE id = ?',
        [pointId]
      );
    });

    test('addComment should execute update SQL and return result', () => {
      // Arrange
      const pointId = 'point-123';
      const value = 'Super point';
      const mockResult = { changes: 1 };
      mockDb.runSync.mockReturnValue(mockResult);

      // Act
      const result = databaseAccess.addComment(pointId, value, mockDb);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'UPDATE point SET comment = ? WHERE id = ?',
        [value, pointId]
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('Picture Functions', () => {
    test('addPicture should generate UUID and INSERT', () => {
      // Arrange
      const pointId = 'point-A';
      const imageBase64 = 'base64data';
      (generateUUID as jest.Mock).mockReturnValue('uuid-pic-1');

      // Act
      databaseAccess.addPicture(pointId, imageBase64, mockDb);

      // Assert
      expect(generateUUID).toHaveBeenCalled();
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'INSERT INTO picture (id, point_id, image) VALUES (?, ?, ?)',
        ['uuid-pic-1', pointId, imageBase64]
      );
    });

    test('updatePicture should execute UPDATE', () => {
      // Arrange
      const picId = 'pic-1';
      const newImg = 'newdata';

      // Act
      databaseAccess.updatePicture(picId, newImg, mockDb);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'UPDATE picture SET image = ? WHERE id = ?',
        [newImg, picId]
      );
    });

    test('deletePicture should execute DELETE', () => {
      // Arrange
      const picId = 'pic-1';

      // Act
      databaseAccess.deletePicture(picId, mockDb);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'DELETE FROM picture WHERE id = ?',
        [picId]
      );
    });
  });

  describe('Equipement/Obstacle Functions', () => {
    test('addEquipement without coordinates should insert only equipement', () => {
      // Arrange
      (generateUUID as jest.Mock).mockReturnValue('uuid-eq-1');
      const eventId = 'evt-1';
      const typeId = 'type-A';
      const quantity = 5;

      // Act
      const resultId = databaseAccess.addEquipement(eventId, typeId, quantity, mockDb);

      // Assert
      expect(resultId).toBe('uuid-eq-1');
      expect(mockDb.runSync).toHaveBeenCalledTimes(1);
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'INSERT INTO equipement (id, event_id, type_id, quantity, length_per_unit) VALUES (?, ?, ?, ?, ?)',
        ['uuid-eq-1', eventId, typeId, quantity, 0]
      );
    });

    test('addEquipement with coordinates should insert equipement AND coordinates', () => {
      // Arrange
      (generateUUID as jest.Mock)
        .mockReturnValueOnce('uuid-eq-1')   // ID equipement
        .mockReturnValueOnce('uuid-coord-1') // ID coord 1
        .mockReturnValueOnce('uuid-coord-2'); // ID coord 2
      
      const coords = [{ x: 10, y: 10 }, { x: 20, y: 20 }];

      // Act
      databaseAccess.addEquipement('evt-1', 'type-A', 1, mockDb, coords);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledTimes(3);
      
      expect(mockDb.runSync).toHaveBeenNthCalledWith(1,
        expect.stringContaining('INSERT INTO equipement'),
        expect.any(Array)
      );

      expect(mockDb.runSync).toHaveBeenCalledWith(
        'INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)',
        ['uuid-coord-1', 'uuid-eq-1', 10, 10, 0]
      );
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)',
        ['uuid-coord-2', 'uuid-eq-1', 20, 20, 1]
      );
    });

    test('updateEquipement should execute UPDATE', () => {
      // Act
      databaseAccess.updateEquipement('eq-1', 10, 2, mockDb);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'UPDATE equipement SET quantity = ?, type_id = ? WHERE id = ?',
        [10, 2, 'eq-1']
      );
    });

    test('deleteEquipement should execute DELETE', () => {
      // Act
      databaseAccess.deleteEquipement('eq-1', mockDb);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'DELETE FROM equipement WHERE id = ?',
        ['eq-1']
      );
    });
  });

  describe('Point Functions', () => {
    test('updatePointCoordinates should execute UPDATE', () => {
      // Act
      databaseAccess.updatePointCoordinates('pt-1', 50.5, 7.5, mockDb);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'UPDATE point SET x = ?, y = ? WHERE id = ?',
        [50.5, 7.5, 'pt-1']
      );
    });

    test('deletePoint should execute DELETE', () => {
      // Act
      databaseAccess.deletePoint('pt-1', mockDb);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'DELETE FROM point WHERE id = ?',
        ['pt-1']
      );
    });

    test('updateTimeStamp should update modified_at with current date', () => {
      // Arrange
      jest.useFakeTimers();
      const fakeDate = new Date('2025-01-01T12:00:00.000Z');
      jest.setSystemTime(fakeDate);

      // Act
      databaseAccess.updateTimeStamp('pt-1', mockDb);

      // Assert
      expect(mockDb.runSync).toHaveBeenCalledWith(
        'UPDATE point SET modified_at = ? WHERE id = ?',
        [fakeDate.toISOString(), 'pt-1']
      );

      jest.useRealTimers();
    });

    test('updateTimeStamp should catch errors silently and log them', () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockDb.runSync.mockImplementation(() => {
        throw new Error('DB Locked');
      });

      // Act
      expect(() => databaseAccess.updateTimeStamp('pt-1', mockDb)).not.toThrow();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to update point's modified_at timestamp:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});