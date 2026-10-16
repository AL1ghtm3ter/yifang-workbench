using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

[assembly: AssemblyTitle("一方工作台")]
[assembly: AssemblyProduct("Yifang Workbench")]
[assembly: AssemblyVersion("0.2.0.1")]

class YifangLauncher {
    static readonly string Root = AppDomain.CurrentDomain.BaseDirectory;
    static readonly string AppRoot = Path.Combine(Root, "app");
    static readonly string Runtime = Path.Combine(Root, ".runtime");
    static readonly string Node = Path.Combine(Root, "runtime", "node.exe");
    static readonly string Script = Path.Combine(AppRoot, "scripts", "server.mjs");
    static readonly string PidFile = Path.Combine(Runtime, "server.pid");
    const string Address = "http://127.0.0.1:4591";

    class Health { public string Root; public int Pid; }
    static bool SamePath(string a, string b) {
        if (String.IsNullOrWhiteSpace(a) || String.IsNullOrWhiteSpace(b)) return false;
        try { return String.Equals(Path.GetFullPath(a).TrimEnd('\\', '/'), Path.GetFullPath(b).TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase); }
        catch { return false; }
    }
    static bool BelongsToThisInstallation(int id, out Process process) {
        process = null;
        try {
            process = Process.GetProcessById(id);
            if (process.HasExited || !SamePath(process.MainModule.FileName, Node)) return false;
            using (var query = new ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE ProcessId=" + id))
            using (var results = query.Get()) {
                foreach (ManagementObject entry in results) {
                    using (entry) {
                        string command = Convert.ToString(entry["CommandLine"]);
                        // Both our launcher and update scripts pass the absolute script in quotes.
                        return command.IndexOf("\"" + Path.GetFullPath(Script) + "\"", StringComparison.OrdinalIgnoreCase) >= 0;
                    }
                }
            }
        } catch { }
        return false;
    }
    static bool Owned(out Process process) {
        process = null;
        try {
            int id;
            return File.Exists(PidFile) && Int32.TryParse(File.ReadAllText(PidFile).Trim(), out id) && BelongsToThisInstallation(id, out process);
        } catch { return false; }
    }
    static Health Healthy() {
        try {
            var request = (HttpWebRequest)WebRequest.Create(Address + "/api/health");
            request.Proxy = null; request.Timeout = 1000;
            using (var response = request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream())) {
                var data = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
                object name, root, pid; int number;
                if (!data.TryGetValue("name", out name) || Convert.ToString(name) != "yifang-workbench") return null;
                data.TryGetValue("root", out root); data.TryGetValue("pid", out pid);
                Int32.TryParse(Convert.ToString(pid), out number);
                return new Health { Root = Convert.ToString(root), Pid = number };
            }
        } catch { return null; }
    }
    static bool Adopt(Health health, out Process process) {
        process = null;
        if (health == null || !SamePath(health.Root, AppRoot) || !BelongsToThisInstallation(health.Pid, out process)) return false;
        File.WriteAllText(PidFile, health.Pid.ToString());
        return true;
    }
    static string Quote(string text) { return "'" + text.Replace("'", "''") + "'"; }
    static void StartServer() {
        if (!File.Exists(Node) || !File.Exists(Script)) throw new Exception("程序文件不完整，请保留整个一方工作台程序文件夹。");
        string command = "$ErrorActionPreference='Stop'; $env:YIFANG_PORT='4591'; $taskService=Start-Process -FilePath " + Quote(Node) +
            " -ArgumentList " + Quote("\"" + Script + "\"") + " -WorkingDirectory " + Quote(AppRoot) +
            " -WindowStyle Hidden -RedirectStandardOutput " + Quote(Path.Combine(Runtime, "server.log")) +
            " -RedirectStandardError " + Quote(Path.Combine(Runtime, "server-error.log")) +
            " -PassThru; [IO.File]::WriteAllText(" + Quote(PidFile) + ",$taskService.Id.ToString())";
        var info = new ProcessStartInfo("powershell.exe", "-NoProfile -NonInteractive -EncodedCommand " + Convert.ToBase64String(Encoding.Unicode.GetBytes(command)));
        info.UseShellExecute = false; info.CreateNoWindow = true;
        using (var runner = Process.Start(info)) {
            if (!runner.WaitForExit(10000) || runner.ExitCode != 0) throw new Exception("启动辅助程序未完成，请查看 .runtime 日志。");
        }
        Process process;
        for (int attempt = 0; attempt < 40; attempt++) {
            if (Adopt(Healthy(), out process)) return;
            Thread.Sleep(250);
        }
        throw new Exception("启动未完成，请查看 .runtime/server-error.log；可能是端口占用或配置无效。");
    }
    [STAThread] static int Main(string[] args) {
        bool check = Array.IndexOf(args, "--check") >= 0;
        try {
            Directory.CreateDirectory(Runtime);
            using (var mutex = new Mutex(false, "Local\\YifangWorkbenchDesktop4591")) {
                bool locked;
                try { locked = mutex.WaitOne(15000); } catch (AbandonedMutexException) { locked = true; }
                if (!locked) throw new Exception("另一次启动仍在进行，请稍后重试。");
                try {
                    Process process; Health health = Healthy();
                    if (Array.IndexOf(args, "--stop") >= 0) {
                        // Never kill a process just because a stale file contains its PID.
                        if (Adopt(health, out process) || Owned(out process)) {
                            process.Kill(); process.WaitForExit(5000); File.Delete(PidFile);
                        }
                        return 0;
                    }
                    if (health != null) {
                        if (!Adopt(health, out process)) throw new Exception("4591端口由其他工作台占用，未停止任何程序。请确认运行的是当前安装目录。");
                    } else {
                        if (Owned(out process)) throw new Exception("本目录的服务正在启动或暂未响应，请稍后重试，或查看 .runtime 日志。");
                        StartServer();
                    }
                } finally { mutex.ReleaseMutex(); }
            }
            File.AppendAllText(Path.Combine(Runtime, "launcher.log"), DateTime.Now.ToString("s") + " ready\r\n");
            if (!check) Process.Start(new ProcessStartInfo(Address + "/#home") { UseShellExecute = true });
            return 0;
        } catch (Exception error) {
            try { File.AppendAllText(Path.Combine(Runtime, "launcher.log"), DateTime.Now.ToString("s") + " " + error.Message + "\r\n"); } catch { }
            if (!check) MessageBox.Show(error.Message, "一方工作台", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 1;
        }
    }
}
