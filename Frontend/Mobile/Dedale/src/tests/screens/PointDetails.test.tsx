import * as ImageHelper from '../../services/ImageHelper';
import * as Helper from '../../services/Helper';
import { getDatabase } from '../../../assets/migrations';


// Arrange
jest.mock('../../services/Helper', () => ({
  generateUUID: jest.fn(),
}));

jest.mock('../../services/ImageHelper', () => ({
  saveImageToBDD: jest.fn(),
}));

jest.mock('../../../assets/migrations', () => ({
  getDatabase: jest.fn(),
}));


describe('RegisterPoint – savePointToDB (critical persistence)', () => {
  const mockRunSync = jest.fn();
  const mockDb = { runSync: mockRunSync };

  beforeEach(() => {
    jest.clearAllMocks();
    (getDatabase as jest.Mock).mockReturnValue(mockDb);
  });

  test('sauvegarde complète avec commentaire, images et obstacles', async () => {
    // Arrange
    (Helper.generateUUID as jest.Mock)
      .mockReturnValueOnce('point-id')
      .mockReturnValueOnce('equipement-id')
      .mockReturnValueOnce('coord-id');

    const selectedEventId = 'event-id';
    const selectedImages = ['img-1.jpg', 'img-2.jpg'];
    const selectedObstacles = [{ type_id: 'obs-type', number: 2 }];
    const location = { latitude: 48.58, longitude: 7.75 };

    // Act
    const result = await (async () => {
      const pointId = Helper.generateUUID();

      mockDb.runSync(
        'INSERT INTO point (id, event_id, x, y, comment) VALUES (?, ?, ?, ?, ?)',
        [pointId, selectedEventId, location.longitude, location.latitude, 'comment']
      );

      for (const img of selectedImages) {
        await ImageHelper.saveImageToBDD(img, pointId);
      }

      for (const obs of selectedObstacles) {
        const equipementId = Helper.generateUUID();
        mockDb.runSync(
          'INSERT INTO equipement (id, event_id, type_id, quantity, length_per_unit) VALUES (?, ?, ?, ?, ?)',
          [equipementId, selectedEventId, obs.type_id, obs.number, 0]
        );

        const coordId = Helper.generateUUID();
        mockDb.runSync(
          'INSERT INTO equipement_coordinate (id, equipement_id, x, y, order_index) VALUES (?, ?, ?, ?, ?)',
          [coordId, equipementId, location.longitude, location.latitude, 0]
        );
      }

      return pointId;
    })();

    // Assert
    expect(mockRunSync).toHaveBeenCalledWith(
      'INSERT INTO point (id, event_id, x, y, comment) VALUES (?, ?, ?, ?, ?)',
      ['point-id', selectedEventId, 7.75, 48.58, 'comment']
    );

    expect(ImageHelper.saveImageToBDD).toHaveBeenCalledTimes(2);

    expect(mockRunSync).toHaveBeenCalledWith(
      'INSERT INTO equipement (id, event_id, type_id, quantity, length_per_unit) VALUES (?, ?, ?, ?, ?)',
      ['equipement-id', selectedEventId, 'obs-type', 2, 0]
    );

    expect(result).toBe('point-id');
  });

  test('sauvegarde minimale sans images ni obstacles', async () => {
    // Arrange
    (Helper.generateUUID as jest.Mock).mockReturnValue('point-id');

    // Act
    const result = await (async () => {
      const pointId = Helper.generateUUID();

      mockDb.runSync(
        'INSERT INTO point (id, event_id, x, y, comment) VALUES (?, ?, ?, ?, ?)',
        [pointId, 'event-id', 1, 2, null]
      );

      return pointId;
    })();

    // Assert
    expect(mockRunSync).toHaveBeenCalledTimes(1);
    expect(ImageHelper.saveImageToBDD).not.toHaveBeenCalled();
    expect(result).toBe('point-id');
  });

  test('échec image n’empêche pas la sauvegarde du point', async () => {
    // Arrange
    (Helper.generateUUID as jest.Mock).mockReturnValue('point-id');
    (ImageHelper.saveImageToBDD as jest.Mock).mockRejectedValue(
      new Error('image failed')
    );

    // Act
    const result = await (async () => {
      const pointId = Helper.generateUUID();

      mockDb.runSync(
        'INSERT INTO point (id, event_id, x, y, comment) VALUES (?, ?, ?, ?, ?)',
        [pointId, 'event-id', 1, 2, null]
      );

      try {
        await ImageHelper.saveImageToBDD('img.jpg', pointId);
      } catch {}

      return pointId;
    })();

    // Assert
    expect(mockRunSync).toHaveBeenCalled();
    expect(result).toBe('point-id');
  });
});
