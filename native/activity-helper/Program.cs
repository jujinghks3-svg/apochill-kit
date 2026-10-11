using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Reflection;
[assembly: AssemblyTitle("Apochill Helper")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyDescription("Local app-name companion for Apochill")]

internal sealed class ActivityService : IDisposable {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    internal static readonly Dictionary<string,string> Apps = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase) {
        {"notion","Notion"},{"chatgpt","ChatGPT"},{"codex","Codex"},{"unrealeditor","Unreal Engine"},
        {"blender","Blender"},{"photoshop","Photoshop"},{"capcut","CapCut"},{"code","VS Code"},
        {"chrome","Chrome"},{"msedge","Edge"},{"firefox","Firefox"},{"figma","Figma"}
    };
    readonly object gate = new object();
    readonly TcpListener listener;
    readonly Semaphore slots = new Semaphore(8,8);
    readonly System.Threading.Timer sampler;
    volatile bool closed;
    bool enabled, connected;
    string app="",pending="";
    DateTime since=DateTime.MinValue, last=DateTime.MinValue, lease=DateTime.MinValue;
    internal int Port {get; private set;}
    internal ActivityService(int port) {
        listener=new TcpListener(IPAddress.Loopback,port);listener.Start(8);
        Port=((IPEndPoint)listener.LocalEndpoint).Port;
        sampler=new System.Threading.Timer(Sample,null,0,1000);
        new Thread(Accept){IsBackground=true}.Start();
    }
    internal static string Map(string name) {string value;return Apps.TryGetValue(name,out value)?value:"";}
    internal void Stop(){lock(gate){enabled=false;connected=false;app="";pending="";}}
    internal string Summary {get{lock(gate){return enabled?(connected?(app==""?"연결됨 · 지원하는 앱으로 전환해 주세요":"현재 앱: "+app):"활성 앱을 확인하는 중…"):"대기 중 · 사이트에서 연결해 주세요";}}}
    void Sample(object unused){
        lock(gate){
            if(closed||!enabled)return;
            if(DateTime.UtcNow-lease>TimeSpan.FromMinutes(2)){Stop();return;}
            try {
                uint id;IntPtr window=GetForegroundWindow();if(window==IntPtr.Zero)throw new Exception();
                GetWindowThreadProcessId(window,out id);
                string name;using(Process process=Process.GetProcessById((int)id)){name=Map(process.ProcessName);}
                DateTime now=DateTime.UtcNow;
                if(!connected)app=name;
                if(pending!=name){pending=name;since=now;}
                if(now-since>=TimeSpan.FromSeconds(1))app=name;
                connected=true;last=now;
            }catch{app="";connected=false;}
        }
    }
    static bool AllowedOrigin(string origin){
        if(origin=="https://apochill.lastweek.chatgpt.site")return true;
        foreach(string host in new[]{"127.0.0.1","localhost"})foreach(int port in new[]{5174,4173,4174})
            if(origin=="http://"+host+":"+port)return true;
        return false;
    }
    void Accept(){while(!closed){try{TcpClient client=listener.AcceptTcpClient();if(!slots.WaitOne(0)){client.Close();continue;}
        ThreadPool.QueueUserWorkItem(delegate{try{Handle(client);}catch{}finally{client.Close();slots.Release();}});
    }catch(SocketException){if(closed)return;}catch(ObjectDisposedException){return;}}}
    void Handle(TcpClient client){
        client.ReceiveTimeout=3000;client.SendTimeout=3000;
        using(NetworkStream stream=client.GetStream()){
            var header=new List<byte>();int b;
            while((b=stream.ReadByte())!=-1){header.Add((byte)b);int n=header.Count;
                if(n>=4&&header[n-4]==13&&header[n-3]==10&&header[n-2]==13&&header[n-1]==10)break;
                if(n>=8192){Reply(stream,431,"",null);return;}}
            string[] lines=Encoding.ASCII.GetString(header.ToArray()).Split(new[]{"\r\n"},StringSplitOptions.None);
            string[] request=lines[0].Split(' ');if(request.Length!=3||request[2]!="HTTP/1.1"){Reply(stream,400,"",null);return;}
            var headers=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
            for(int i=1;i<lines.Length;i++){if(lines[i]=="")continue;int colon=lines[i].IndexOf(':');
                if(colon<=0||headers.ContainsKey(lines[i].Substring(0,colon))){Reply(stream,400,"",null);return;}
                headers.Add(lines[i].Substring(0,colon),lines[i].Substring(colon+1).Trim());}
            string host,origin;
            if(!headers.TryGetValue("Host",out host)||host!="127.0.0.1:"+Port||!headers.TryGetValue("Origin",out origin)||!AllowedOrigin(origin)){
                Reply(stream,403,"",null);return;}
            string rawLength;int length=0;
            if(headers.ContainsKey("Transfer-Encoding")||(headers.TryGetValue("Content-Length",out rawLength)&&(!int.TryParse(rawLength,out length)||length<0||length>1024))){Reply(stream,400,"",origin);return;}
            byte[] body=new byte[length];int count=0;while(count<length){int read=stream.Read(body,count,length-count);if(read==0)return;count+=read;}
            string method=request[0],path=request[1];
            if(method=="OPTIONS"&&(path=="/status"||path=="/start"||path=="/stop")){Reply(stream,204,"",origin);return;}
            if(method=="GET"&&path=="/status"){
                string json;lock(gate){if(enabled)lease=DateTime.UtcNow;bool fresh=connected&&DateTime.UtcNow-last<TimeSpan.FromSeconds(6.5);
                    json=new JavaScriptSerializer().Serialize(new {protocol=2,enabled=enabled,connected=enabled&&fresh,app=enabled&&fresh?app:"",text="",helperVersion="1.0.0"});}
                Reply(stream,200,json,origin);return;
            }
            string contentType;
            if(method=="POST"&&(path=="/start"||path=="/stop")&&headers.TryGetValue("Content-Type",out contentType)&&contentType=="application/json"&&Encoding.UTF8.GetString(body).Trim()=="{}"){
                lock(gate){if(path=="/start"){enabled=true;lease=DateTime.UtcNow;}else Stop();}Reply(stream,204,"",origin);return;
            }
            Reply(stream,404,"",origin);
        }
    }
    static void Reply(NetworkStream stream,int code,string body,string origin){
        byte[] bytes=Encoding.UTF8.GetBytes(body);
        string head="HTTP/1.1 "+code+" "+(code==200?"OK":code==204?"No Content":"Error")+"\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: "+bytes.Length+"\r\n";
        if(origin!=null)head+="Access-Control-Allow-Origin: "+origin+"\r\nVary: Origin\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nAccess-Control-Allow-Private-Network: true\r\n";
        byte[] prefix=Encoding.ASCII.GetBytes(head+"\r\n");stream.Write(prefix,0,prefix.Length);stream.Write(bytes,0,bytes.Length);
    }
    public void Dispose(){closed=true;Stop();sampler.Dispose();listener.Stop();}
    internal static string TestRequest(int port,string method,string path,string origin,string host,string body){
        using(TcpClient c=new TcpClient("127.0.0.1",port)){c.ReceiveTimeout=5000;var s=c.GetStream();
            string text=method+" "+path+" HTTP/1.1\r\nHost: "+host+"\r\nOrigin: "+origin+"\r\nContent-Type: application/json\r\nContent-Length: "+Encoding.UTF8.GetByteCount(body)+"\r\n\r\n"+body;
            byte[] data=Encoding.UTF8.GetBytes(text);s.Write(data,0,data.Length);using(var r=new StreamReader(s)){
                var result=new StringBuilder();string line;int length=0;
                while((line=r.ReadLine())!=null){result.Append(line+"\r\n");if(line=="")break;if(line.StartsWith("Content-Length: "))length=int.Parse(line.Substring(16));}
                char[] bodyChars=new char[length];int read=0;while(read<length){int n=r.Read(bodyChars,read,length-read);if(n==0)break;read+=n;}
                result.Append(bodyChars,0,read);return result.ToString();}}
    }
}
internal sealed class HelperWindow : Form {
    readonly ActivityService service; readonly NotifyIcon tray; readonly System.Windows.Forms.Timer timer;
    readonly Label status; bool exiting;
    internal HelperWindow(ActivityService service){
        this.service=service;Text="Apochill · 작업 연결 도우미";ClientSize=new Size(455,295);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;StartPosition=FormStartPosition.CenterScreen;
        Font=new Font("Malgun Gothic",10);BackColor=Color.FromArgb(246,248,242);
        var title=new Label{Text="캐릭터와 함께 작업할 준비가 됐어요",AutoSize=true,Location=new Point(22,22),Font=new Font("Malgun Gothic",13,FontStyle.Bold)};
        var help=new Label{Text="사이트에서 ‘작업 상태 · PC 연결’을 열고 연결해 주세요.\n앱 이름만 이 PC 안에서 전달하며, 창 제목이나 문서 내용은 읽지 않습니다.",Location=new Point(22,63),Size=new Size(409,67)};
        status=new Label{Text=service.Summary,Location=new Point(22,140),Size=new Size(409,28),ForeColor=Color.FromArgb(49,91,68)};
        var open=new Button{Text="Apochill 열기",Location=new Point(22,183),Size=new Size(135,36)};
        open.Click+=delegate{Process.Start(new ProcessStartInfo("https://apochill.lastweek.chatgpt.site/"){UseShellExecute=true});};
        var pause=new Button{Text="감지 끄기",Location=new Point(167,183),Size=new Size(120,36)};pause.Click+=delegate{service.Stop();status.Text=service.Summary;};
        var quit=new Button{Text="종료",Location=new Point(297,183),Size=new Size(130,36)};quit.Click+=delegate{Exit();};
        var note=new Label{Text="창을 닫으면 숨겨진 아이콘에서 계속 실행됩니다.\n자동 시작은 등록하지 않으며, 사이트와 2분간 통신이 없으면 감지를 멈춥니다.",Location=new Point(22,235),Size=new Size(409,48),Font=new Font("Malgun Gothic",8)};
        Controls.AddRange(new Control[]{title,help,status,open,pause,quit,note});
        tray=new NotifyIcon{Icon=SystemIcons.Application,Text="Apochill 작업 연결 도우미",Visible=true};
        var menu=new ContextMenuStrip();menu.Items.Add("도우미 열기",null,delegate{Show();WindowState=FormWindowState.Normal;Activate();});menu.Items.Add("감지 끄기",null,delegate{service.Stop();});menu.Items.Add("종료",null,delegate{Exit();});tray.ContextMenuStrip=menu;
        tray.DoubleClick+=delegate{Show();Activate();};
        FormClosing+=delegate(object sender,FormClosingEventArgs e){if(!exiting){e.Cancel=true;Hide();}};
        timer=new System.Windows.Forms.Timer{Interval=1000};timer.Tick+=delegate{status.Text=service.Summary;};timer.Start();
    }
    void Exit(){exiting=true;timer.Stop();tray.Visible=false;tray.Dispose();service.Dispose();Close();}
    protected override void Dispose(bool disposing){if(disposing){timer.Dispose();tray.Dispose();}base.Dispose(disposing);}
}
internal static class Program {
    static void Check(bool condition,string name){if(!condition)throw new Exception(name);}
    static int SelfTest(string file){
        try{int checks=0;using(var s=new ActivityService(0)){
            string origin="https://apochill.lastweek.chatgpt.site",host="127.0.0.1:"+s.Port;
            Func<string,string,string,string,string,string> send=(m,p,o,h,b)=>ActivityService.TestRequest(s.Port,m,p,o,h,b);
            Check(send("GET","/status",origin,host,"").Contains("\"enabled\":false"),"starts disabled");checks++;
            Check(send("POST","/start","https://evil.invalid",host,"{}").StartsWith("HTTP/1.1 403"),"foreign origin");checks++;
            Check(send("GET","/status",origin,"evil.invalid","").StartsWith("HTTP/1.1 403"),"host rebinding");checks++;
            Check(send("POST","/start",origin,host,"{}").StartsWith("HTTP/1.1 204"),"start");checks++;
            Check(send("GET","/status",origin,host,"").Contains("\"enabled\":true"),"enabled");checks++;
            Check(send("OPTIONS","/start",origin,host,"").Contains("Access-Control-Allow-Private-Network: true"),"preflight");checks++;
            Check(send("POST","/stop",origin,host,"{}").StartsWith("HTTP/1.1 204"),"stop");checks++;
            Check(send("GET","/status",origin,host,"").Contains("\"enabled\":false"),"stopped");checks++;
            Check(send("POST","/start",origin,host,"{bad}").StartsWith("HTTP/1.1 404"),"reject bad body");checks++;
            Check(send("POST","/start",origin,host,new string('x',1025)).StartsWith("HTTP/1.1 400"),"bound body");checks++;
            Check(ActivityService.Map("private-app-name")==""&&ActivityService.Map("NOTION")=="Notion","name allowlist");checks++;
            Check(send("GET","/status","http://localhost:4173",host,"").StartsWith("HTTP/1.1 200"),"local preview");checks++;
        }File.WriteAllText(file,"{\"passed\":"+checks+"}");return 0;}catch(Exception e){File.WriteAllText(file,"FAILED: "+e.Message);return 1;}
    }
    [STAThread] static int Main(string[] args){
        if(args.Length==2&&args[0]=="--self-test")return SelfTest(args[1]);
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        bool fresh;using(var mutex=new Mutex(true,"Local\\ApochillActivityHelper",out fresh)){
            if(!fresh){MessageBox.Show("도우미가 이미 실행 중이에요. 작업 표시줄의 숨겨진 아이콘에서 열거나 사이트에서 연결해 주세요.","Apochill");return 0;}
            try{using(var service=new ActivityService(5175))using(var window=new HelperWindow(service)){Application.Run(window);}}
            catch(SocketException){MessageBox.Show("기존 Apochill 도우미가 실행 중이거나 연결 포트가 사용 중입니다. 기존 도우미를 종료한 뒤 다시 실행해 주세요.","Apochill");return 1;}
            catch(Exception){MessageBox.Show("도우미를 시작하지 못했습니다. 파일의 압축을 푼 뒤 다시 실행해 주세요.","Apochill");return 1;}
        }return 0;
    }
}
