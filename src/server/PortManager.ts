import { Platform } from "obsidian";
import { getHttpModule, getOsModule } from "../utils/platformModules";

export class PortManager {
  private http: typeof import("http") | null = null;

  /**
   * Initialize Node.js modules
   */
  private async initialize(): Promise<void> {
    if (Platform.isMobileApp) {
      return;
    }

    if (!this.http) {
      this.http = getHttpModule();
    }
  }
  /**
   * Find an available port within the given range
   * @param start Start of port range
   * @param end End of port range
   * @returns Available port number or null if none found
   */
  async findAvailablePort(start: number, end: number): Promise<number | null> {
    await this.initialize();

    if (!this.http || Platform.isMobileApp) {
      return null;
    }

    for (let port = start; port <= end; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    return null;
  }

  /**
   * Check if a specific port is available
   * @param port Port number to check
   * @returns true if port is available
   */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.http) {
        resolve(false);
        return;
      }
      const server = this.http.createServer();

      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          resolve(false);
        } else {
          resolve(false);
        }
      });

      server.once("listening", () => {
        server.close();
        resolve(true);
      });

      server.listen(port);
    });
  }

  /**
   * Get local network IP address
   * @returns Local IP address or 'localhost'
   */
  async getLocalIP(): Promise<string> {
    if (Platform.isMobileApp) {
      return "localhost";
    }

    const os = getOsModule();

    if (!os) {
      return "localhost";
    }

    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      const ifaces = interfaces[name];
      if (!ifaces) continue;

      for (const iface of ifaces) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }

    return "localhost";
  }
}
