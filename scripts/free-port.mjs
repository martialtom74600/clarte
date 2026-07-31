import { execSync } from "node:child_process";

const port = process.argv[2] ?? "3000";

function freePortWindows(targetPort) {
  let output = "";
  try {
    output = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: "utf8" });
  } catch {
    return;
  }

  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/LISTENING\s+(\d+)\s*$/);
    if (match) pids.add(match[1]);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      console.log(`[free-port] Port ${targetPort} libéré (PID ${pid}).`);
    } catch {
      // Process may already be gone.
    }
  }
}

function freePortUnix(targetPort) {
  try {
    execSync(`lsof -ti tcp:${targetPort} | xargs -r kill -9`, {
      stdio: "ignore",
      shell: true,
    });
    console.log(`[free-port] Port ${targetPort} libéré.`);
  } catch {
    // Nothing listening.
  }
}

if (process.platform === "win32") {
  freePortWindows(port);
} else {
  freePortUnix(port);
}
