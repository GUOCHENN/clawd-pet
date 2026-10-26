// Watches whether the foreground window is a fullscreen app (a game, a fullscreen video):
// it covers its whole monitor and has no title bar, so maximized windows don't count.
// Uses one long-lived PowerShell process calling user32 through Add-Type, so no native
// Node modules are needed. Calls onChange(true/false) when the state flips.
const { spawn } = require('child_process');
const readline = require('readline');

const SCRIPT = String.raw`
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ClawdFg {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int index);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static string State() {
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero) return "NO 0";
    uint pid; GetWindowThreadProcessId(h, out pid);
    StringBuilder sb = new StringBuilder(256); GetClassName(h, sb, 256);
    string c = sb.ToString();
    if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") return "NO " + pid;
    if ((GetWindowLong(h, -16) & 0x00C00000) == 0x00C00000) return "NO " + pid + " " + c + " caption"; // has a caption
    RECT r; if (!GetWindowRect(h, out r)) return "NO " + pid;
    MONITORINFO mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(mi);
    if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return "NO " + pid;
    bool full = r.L <= mi.rcMonitor.L && r.T <= mi.rcMonitor.T && r.R >= mi.rcMonitor.R && r.B >= mi.rcMonitor.B;
    return (full ? "FS " : "NO ") + pid + " " + c + " win=" + r.L + "," + r.T + "," + r.R + "," + r.B + " mon=" + mi.rcMonitor.L + "," + mi.rcMonitor.T + "," + mi.rcMonitor.R + "," + mi.rcMonitor.B;
  }
}
"@
while ($true) { [Console]::Out.WriteLine([ClawdFg]::State()); [Console]::Out.Flush(); Start-Sleep -Milliseconds 1000 }
`;

function watchFullscreen(onChange, { ownPids = () => [], onLine = null } = {}) {
  let child = null;
  let stopped = false;
  let last = null;

  const start = () => {
    const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64');
    child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      if (onLine) onLine(line);
      const [state, pid] = line.trim().split(' ');
      // our own window is never "the game"
      const full = state === 'FS' && !ownPids().includes(Number(pid));
      if (full !== last) { last = full; onChange(full); }
    });
    child.on('exit', () => { if (!stopped) setTimeout(start, 3000); }); // restart if it dies
  };
  start();

  return () => { stopped = true; if (child) child.kill(); };
}

module.exports = { watchFullscreen };
