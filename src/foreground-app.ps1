# Emits only the foreground executable's ProcessName. Never reads window titles.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ForegroundApp {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
}
'@
while ($true) {
  try {
    [uint32]$foregroundProcessId = 0
    $foregroundWindow = [ForegroundApp]::GetForegroundWindow()
    if ($foregroundWindow -eq [IntPtr]::Zero) { throw 'No foreground window' }
    [void][ForegroundApp]::GetWindowThreadProcessId($foregroundWindow, [ref]$foregroundProcessId)
    if ($foregroundProcessId -eq 0) { throw 'No foreground process' }
    $foregroundProcess = Get-Process -Id $foregroundProcessId -ErrorAction Stop
    [Console]::WriteLine($foregroundProcess.ProcessName)
  } catch { [Console]::WriteLine('') }
  Start-Sleep -Milliseconds 1000
}
