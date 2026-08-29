import profiler from 'v8-profiler-next';
import fs from 'fs';
import path from 'path';
import v8 from 'v8';
import type { Application, Request, Response } from 'express';

const PROFILE_DIR = process.env.PROFILE_DIR || './profiles';

// Ensure profile directory exists
if (!fs.existsSync(PROFILE_DIR)) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
}

export class PerformanceProfiler {
  private cpuProfileActive = false;
  private heapSnapshotInterval: NodeJS.Timeout | null = null;

  /**
   * Start CPU profiling
   */
  startCPUProfile(name: string = 'cpu-profile') {
    if (this.cpuProfileActive) {
      console.warn('CPU profiling already active');
      return;
    }

    profiler.startProfiling(name, true);
    this.cpuProfileActive = true;
    console.log(`CPU profiling started: ${name}`);
  }

  /**
   * Stop CPU profiling and save to file
   */
  stopCPUProfile(name: string = 'cpu-profile') {
    if (!this.cpuProfileActive) {
      console.warn('No active CPU profile');
      return;
    }

    const profile = profiler.stopProfiling(name);
    const filename = path.join(PROFILE_DIR, `${name}-${Date.now()}.cpuprofile`);

    profile.export((error, result) => {
      if (error) {
        console.error('Error exporting CPU profile:', error);
        return;
      }

      fs.writeFileSync(filename, result);
      console.log(`CPU profile saved: ${filename}`);
      profile.delete();
    });

    this.cpuProfileActive = false;
  }

  /**
   * Take a heap snapshot
   */
  takeHeapSnapshot(name: string = 'heap-snapshot') {
    const filename = path.join(PROFILE_DIR, `${name}-${Date.now()}.heapsnapshot`);
    const snapshot = v8.writeHeapSnapshot(filename);
    console.log(`Heap snapshot saved: ${snapshot}`);
    return snapshot;
  }

  /**
   * Start periodic heap snapshots
   */
  startPeriodicHeapSnapshots(intervalMs: number = 3600000) {
    // Default: 1 hour
    if (this.heapSnapshotInterval) {
      console.warn('Periodic heap snapshots already running');
      return;
    }

    this.heapSnapshotInterval = setInterval(() => {
      this.takeHeapSnapshot('periodic-heap');
    }, intervalMs);

    console.log(`Periodic heap snapshots started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop periodic heap snapshots
   */
  stopPeriodicHeapSnapshots() {
    if (this.heapSnapshotInterval) {
      clearInterval(this.heapSnapshotInterval);
      this.heapSnapshotInterval = null;
      console.log('Periodic heap snapshots stopped');
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024), // MB
    };
  }

  /**
   * Get CPU usage statistics
   */
  getCPUStats() {
    const usage = process.cpuUsage();
    return {
      user: usage.user / 1000000, // Convert to seconds
      system: usage.system / 1000000, // Convert to seconds
    };
  }

  /**
   * Profile a specific function
   */
  async profileFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startCPUProfile(name);
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      console.log(`Function ${name} completed in ${duration}ms`);
      return result;
    } finally {
      this.stopCPUProfile(name);
    }
  }
}

export const profiler = new PerformanceProfiler();

// Expose profiler endpoints for on-demand profiling
export function setupProfilerEndpoints(app: Application) {
  // Start CPU profiling
  app.post('/admin/profiler/cpu/start', (req: Request, res: Response) => {
    const name = req.body.name || 'manual-cpu-profile';
    profiler.startCPUProfile(name);
    res.json({ message: 'CPU profiling started', name });
  });

  // Stop CPU profiling
  app.post('/admin/profiler/cpu/stop', (req: Request, res: Response) => {
    const name = req.body.name || 'manual-cpu-profile';
    profiler.stopCPUProfile(name);
    res.json({ message: 'CPU profiling stopped', name });
  });

  // Take heap snapshot
  app.post('/admin/profiler/heap/snapshot', (req: Request, res: Response) => {
    const name = req.body.name || 'manual-heap-snapshot';
    const filename = profiler.takeHeapSnapshot(name);
    res.json({ message: 'Heap snapshot taken', filename });
  });

  // Get memory stats
  app.get('/admin/profiler/memory', (req: Request, res: Response) => {
    const stats = profiler.getMemoryStats();
    res.json(stats);
  });

  // Get CPU stats
  app.get('/admin/profiler/cpu', (req: Request, res: Response) => {
    const stats = profiler.getCPUStats();
    res.json(stats);
  });
}
