// jest.setup.js

// 0. Mock NativeWind (DOIT ÊTRE EN PREMIER)
jest.mock('nativewind', () => ({
  styled: (Component) => Component,
}));

// 1. BLOQUAGE CRITIQUE DU RUNTIME EXPO WINTER
// Mock TurboModuleRegistry avec getConstants
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  get: jest.fn((name) => {
    if (name === 'DeviceInfo') {
      return {
        getConstants: () => ({
          Dimensions: {
            window: { width: 375, height: 812, scale: 2, fontScale: 1 },
            screen: { width: 375, height: 812, scale: 2, fontScale: 1 },
          },
        }),
      };
    }
    return { getConstants: () => ({}) };
  }),
  getEnforcing: jest.fn((name) => {
    if (name === 'DeviceInfo') {
      return {
        getConstants: () => ({
          Dimensions: {
            window: { width: 375, height: 812, scale: 2, fontScale: 1 },
            screen: { width: 375, height: 812, scale: 2, fontScale: 1 },
          },
        }),
      };
    }
    if (name === 'SourceCode') {
      return { scriptURL: 'test://test' };
    }
    return { getConstants: () => ({}) };
  }),
}));

// Mock NativeDeviceInfo
jest.mock('react-native/src/private/specs_DEPRECATED/modules/NativeDeviceInfo', () => ({
  __esModule: true,
  default: {
    getConstants: () => ({
      Dimensions: {
        window: { width: 375, height: 812, scale: 2, fontScale: 1 },
        screen: { width: 375, height: 812, scale: 2, fontScale: 1 },
      },
    }),
  },
}));

// Mock expo-modules-core SANS requireActual
jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(() => ({})),
  NativeModulesProxy: {},
  EventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
  Platform: { OS: 'ios' },
}));

jest.mock('expo', () => ({
  registerRootComponent: jest.fn(),
}));

// 2. Mock du Pont React Native (Empêche l'erreur "__fbBatchedBridgeConfig")
jest.mock('react-native/Libraries/BatchedBridge/NativeModules', () => ({
  AlertManager: {
    alertWithArgs: jest.fn(),
  },
}));

// 3. Mock des Icônes (Empêche le crash sur ConnectEvent)
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const mockComponent = (name) => {
    return (props) => React.createElement('View', { ...props, testID: name });
  };
  return {
    Feather: mockComponent('Feather'),
    Ionicons: mockComponent('Ionicons'),
    MaterialIcons: mockComponent('MaterialIcons'),
    FontAwesome: mockComponent('FontAwesome'),
    AntDesign: mockComponent('AntDesign'),
  };
});

// 4. Mock SQLite (Indispensable pour tes tests de logique)
const mockDb = {
  runSync: jest.fn(() => ({ lastInsertRowId: 1, changes: 1 })),
  getAllSync: jest.fn(() => []),
  getFirstSync: jest.fn(),
  execSync: jest.fn(),
  withTransactionSync: jest.fn((cb) => cb()),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => mockDb),
}));

// 5. Mock migrations/getDatabase
jest.mock('./assets/migrations', () => ({
  getDatabase: jest.fn(() => mockDb),
  default: jest.fn(() => mockDb),
}));

jest.mock('./assets/migrations/index', () => ({
  getDatabase: jest.fn(() => mockDb),
  default: jest.fn(() => mockDb),
}));

// 6. Autres Mocks natifs nécessaires
jest.mock('expo-font', () => ({
  isLoaded: jest.fn().mockReturnValue(true),
  loadAsync: jest.fn(),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    loadAsync: jest.fn(),
    fromModule: jest.fn(() => ({ uri: 'test-uri' })),
  },
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  documentDirectory: 'file:///test-directory/',
}));

// 7. Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props) => React.createElement('View', { ...props, testID: 'MapView' }),
    Marker: (props) => React.createElement('View', { ...props, testID: 'Marker' }),
    Polyline: (props) => React.createElement('View', { ...props, testID: 'Polyline' }),
    Callout: (props) => React.createElement('View', { ...props, testID: 'Callout' }),
    PROVIDER_DEFAULT: 'default',
    PROVIDER_GOOGLE: 'google',
  };
});

// 8. Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  return {
    GestureHandlerRootView: ({ children }) => React.createElement('View', null, children),
    PanGestureHandler: ({ children }) => children,
    TapGestureHandler: ({ children }) => children,
    State: {},
    Directions: {},
    gestureHandlerRootHOC: (component) => component,
    Swipeable: ({ children }) => children,
    DrawerLayout: ({ children }) => children,
    ScrollView: ({ children }) => React.createElement('View', null, children),
    FlatList: ({ children }) => React.createElement('View', null, children),
  };
});

// 9. Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => children,
    View: ({ children }) => React.createElement('View', null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
  };
});

// 10. Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 10 },
  })),
  watchPositionAsync: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
    BestForNavigation: 6,
  },
}));

// 11. Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    default: {
      createAnimatedComponent: (component) => component,
      View: ({ children }) => React.createElement('View', null, children),
      Text: ({ children }) => React.createElement('Text', null, children),
      call: jest.fn(),
      Value: jest.fn(),
      event: jest.fn(),
      add: jest.fn(),
      eq: jest.fn(),
      set: jest.fn(),
      cond: jest.fn(),
      interpolate: jest.fn(),
      Extrapolate: { CLAMP: 'clamp' },
    },
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((value) => value),
    withSpring: jest.fn((value) => value),
    runOnJS: jest.fn((fn) => fn),
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      inOut: jest.fn(),
    },
  };
});

// 12. Mock react-native-screens
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
  Screen: ({ children }) => children,
  ScreenContainer: ({ children }) => children,
  NativeScreen: ({ children }) => children,
  NativeScreenContainer: ({ children }) => children,
}));

// 13. Mock react-native-draggable-flatlist
jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ data, renderItem }) => {
      return React.createElement('View', null, 
        data?.map((item, index) => renderItem({ item, index, drag: jest.fn(), isActive: false }))
      );
    },
  };
});