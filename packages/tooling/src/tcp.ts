import net from "node:net";

/** Resolves once the port accepts a TCP connection, without speaking any protocol. */
export function isPortAccepting(
  host: string,
  port: number,
  timeoutMs = 1000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const settle = (accepting: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(accepting);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      settle(true);
    });
    socket.once("timeout", () => {
      settle(false);
    });
    socket.once("error", () => {
      settle(false);
    });
    socket.connect(port, host);
  });
}

export async function waitForPort(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isPortAccepting(host, port)) {
      return true;
    }
    await delay(500);
  }

  return false;
}

/** Returns the first free port at or after `preferred`, on the loopback interface. */
export async function findFreePort(
  host: string,
  preferred: number,
  attempts = 20,
): Promise<number> {
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = preferred + offset;
    if (!(await isPortAccepting(host, candidate))) {
      return candidate;
    }
  }

  throw new Error(
    `No free TCP port found between ${preferred} and ${preferred + attempts - 1}.`,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
