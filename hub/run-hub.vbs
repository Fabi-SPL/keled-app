' Keled widget hub, started hidden at logon by the scheduled task "KeledWidgetHub".
' Same pattern as Olympus run-web.vbs: no window, restart 5 s after any exit.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Programs\Claude\keled-app\hub"
Do
  sh.Run "cmd /c ""C:\Program Files\nodejs\node.exe"" server.mjs >> data\hub.log 2>&1", 0, True
  WScript.Sleep 5000
Loop
