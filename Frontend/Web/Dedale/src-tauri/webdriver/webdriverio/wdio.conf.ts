import type { Options } from '@wdio/types';
import * as path from 'path';
import { spawn, spawnSync, ChildProcess } from 'child_process';

// Chemin vers le binaire Tauri buildé
const tauriBinary = path.resolve(
  __dirname,
  '../../target/release/dedale'
);

// Trouver tauri-driver: d'abord via which, puis fallback sur CARGO_HOME ou PATH
function findTauriDriver(): string {
  const whichResult = spawnSync('which', ['tauri-driver']);
  if (whichResult.status === 0) {
    return whichResult.stdout.toString().trim();
  }
  
  // Fallback: CARGO_HOME/bin ou juste 'tauri-driver'
  if (process.env.CARGO_HOME) {
    return path.join(process.env.CARGO_HOME, 'bin', 'tauri-driver');
  }
  
  return 'tauri-driver';
}

const tauriDriverPath = findTauriDriver();

let tauriDriver: ChildProcess;

export const config: Options.Testrunner = {
  runner: 'local',
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      project: './tsconfig.json',
    },
  },

  specs: ['./test/specs/**/*.ts'],
  exclude: [],

  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      // Pour Tauri, utiliser 'wry' (le moteur WebView de Tauri)
      browserName: 'wry',
      'tauri:options': {
        application: tauriBinary,
      },
    } as any,
  ],

  logLevel: 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  port: 4444,
  hostname: '127.0.0.1',

  framework: 'mocha',
  reporters: [
    'spec',
    [
      'junit',
      {
        outputDir: './reports',
        outputFileFormat: function (options: { cid: string }) {
          return `results-${options.cid}.xml`;
        },
      },
    ],
  ],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  // Démarrer tauri-driver avant les tests
  onPrepare: function () {
    console.log(`Starting tauri-driver from: ${tauriDriverPath}`);
    tauriDriver = spawn(tauriDriverPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${process.env.CARGO_HOME}/bin:${process.env.PATH}` },
    });

    tauriDriver.stdout?.on('data', (data: Buffer) => {
      console.log(`[tauri-driver] ${data.toString()}`);
    });

    tauriDriver.stderr?.on('data', (data: Buffer) => {
      console.error(`[tauri-driver] ${data.toString()}`);
    });

    // Attendre que tauri-driver soit prêt
    return new Promise<void>((resolve) => {
      setTimeout(resolve, 2000);
    });
  },

  // Arrêter tauri-driver après les tests
  onComplete: function () {
    if (tauriDriver) {
      tauriDriver.kill();
    }
  },

  // Prendre une capture d'écran en cas d'échec
  afterTest: async function (
    test: { title: string },
    _context: unknown,
    { error }: { error?: Error }
  ) {
    if (error) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${test.title.replace(/\s+/g, '_')}-${timestamp}.png`;
      await browser.saveScreenshot(`./screenshots/${filename}`);
    }
  },
};
