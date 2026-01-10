import { savePointToDB } from '../../screens/RegisterPoint';
import * as ImageHelper from '../../services/ImageHelper';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
    requestCameraPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  return {
      __esModule: true,
      default: React.Fragment,
      Marker: React.Fragment,
  };
});

jest.mock('../../../assets/migrations', () => ({
  __esModule: true,
  default: jest.fn(() => ({ runSync: jest.fn() })), 
}));

jest.mock('../../services/ImageHelper', () => ({
  saveImageToBDD: jest.fn(),
}));

describe('Logic: RegisterPoint orchestration', () => {
  const mockDb = {
    runSync: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('savePointToDB exécute toute la séquence d\'insertion avec succès', async () => {
    // ARRANGE
    mockDb.runSync.mockReturnValue({ lastInsertRowId: 123 });

    const inputs = {
      x: 7.75,
      y: 48.58,
      comment: "Test complet",
      images: ["img1.jpg", "img2.jpg"],
      obstacles: [{ type_id: 1, number: 2 }],
      eventId: 55
    };

    // ACT
    const resultId = await savePointToDB(
      mockDb,
      inputs.x,
      inputs.y,
      inputs.comment,
      inputs.images,
      inputs.obstacles,
      inputs.eventId
    );

    // ASSERT
    expect(mockDb.runSync).toHaveBeenNthCalledWith(1,
      "INSERT INTO point (x, y) VALUES (?, ?)",
      [inputs.x, inputs.y]
    );
    expect(mockDb.runSync).toHaveBeenCalledWith(
        "INSERT INTO point_event (point_id, event_id) VALUES (?, ?)",
        [123, 55]
    );
    expect(mockDb.runSync).toHaveBeenCalledWith(
      "INSERT INTO comment (point_id, value) VALUES (?, ?)",
      [123, inputs.comment]
    );
    expect(mockDb.runSync).toHaveBeenCalledWith(
      "INSERT INTO obstacle (point_id, type_id, number) VALUES (?, ?, ?)",
      [123, 1, 2]
    );

    expect(ImageHelper.saveImageToBDD).toHaveBeenCalledTimes(2);
    expect(ImageHelper.saveImageToBDD).toHaveBeenCalledWith("img1.jpg", 123);
    expect(resultId).toBe(123);
  });

  test('savePointToDB gère le cas sans événement (eventId null)', async () => {
    // ARRANGE
    mockDb.runSync.mockReturnValue({ lastInsertRowId: 99 });

    // ACT
    await savePointToDB(mockDb, 0, 0, "", [], [], null);

    // ASSERT
    expect(mockDb.runSync).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO point_event"),
      expect.anything()
    );
  });
})