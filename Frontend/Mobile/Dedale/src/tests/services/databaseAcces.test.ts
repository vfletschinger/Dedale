import {
  addComment,
  deletePoint,
  updatePointCoordinates,
  addObstacle,
  updateTimeStamp
} from '../../services/databaseAcces';

describe('Service: Database Access', () => {
  const mockDb = {
    runSync: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('addComment exécute la bonne requête SQL', () => {
    // ARRANGE
    const pointId = 1;
    const value = "Super vue";

    // ACT
    addComment(pointId, value, mockDb);

    // ASSERT
    expect(mockDb.runSync).toHaveBeenCalledTimes(1);
    expect(mockDb.runSync).toHaveBeenCalledWith(
      'INSERT INTO comment (point_id, value) VALUES (?, ?)',
      [pointId, value]
    );
  });

  test('updatePointCoordinates met à jour X et Y', () => {
    // ACT
    updatePointCoordinates(10, 48.5, 7.7, mockDb);

    // ASSERT
    expect(mockDb.runSync).toHaveBeenCalledWith(
      'UPDATE point SET x = ?, y = ? WHERE id = ?',
      [48.5, 7.7, 10]
    );
  });

  test('deletePoint retourne le résultat de runSync', () => {
    // ARRANGE
    const mockResult = { changes: 1 };
    mockDb.runSync.mockReturnValue(mockResult);

    // ACT
    const result = deletePoint(5, mockDb);

    // ASSERT
    expect(mockDb.runSync).toHaveBeenCalledWith(
      'DELETE FROM point WHERE id = ?',
      [5]
    );
    expect(result).toBe(mockResult);
  });
  
  test('updateTimeStamp gère les erreurs silencieusement', () => {
    // ARRANGE
    mockDb.runSync.mockImplementation(() => {
        throw new Error("DB Error");
    });
    
    // ACT
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // ASSERT
    expect(() => updateTimeStamp(1, mockDb)).not.toThrow();
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});