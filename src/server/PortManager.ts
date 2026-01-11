import * as http from 'http';

export class PortManager {
	/**
	 * Find an available port within the given range
	 * @param start Start of port range
	 * @param end End of port range
	 * @returns Available port number or null if none found
	 */
	async findAvailablePort(start: number, end: number): Promise<number | null> {
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
			const server = http.createServer();

			server.once('error', (err: any) => {
				if (err.code === 'EADDRINUSE') {
					resolve(false);
				} else {
					resolve(false);
				}
			});

			server.once('listening', () => {
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
	getLocalIP(): string {
		const os = require('os');
		const interfaces = os.networkInterfaces();

		for (const name of Object.keys(interfaces)) {
			for (const iface of interfaces[name]) {
				// Skip internal (loopback) and non-IPv4 addresses
				if (iface.family === 'IPv4' && !iface.internal) {
					return iface.address;
				}
			}
		}

		return 'localhost';
	}
}
