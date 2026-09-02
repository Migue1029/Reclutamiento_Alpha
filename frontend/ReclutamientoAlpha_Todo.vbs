' ReclutamientoAlpha_Todo.vbs
' Inicia el backend y la app de escritorio (Electron) SIN mostrar ventanas de consola

Option Explicit

Dim shell, root, cmdBackend, cmdDesktop

Set shell = CreateObject("Wscript.Shell")

' 🔧 RUTA RAÍZ DEL PROYECTO
root = "C:\ReclutaminetoAlpha-Entrega"

' 1) Iniciar BACKEND (Node/Express)
cmdBackend = "cmd /c cd /d """ & root & "\backend"" && npm start"
shell.Run cmdBackend, 0, False   ' 0 = ventana oculta, False = no esperar a que termine

' Dar tiempo a que el backend arranque (5 segundos)
WScript.Sleep 5000  ' 5000 milisegundos = 5 seg

' 2) Iniciar APP DE ESCRITORIO (Electron)
cmdDesktop = "cmd /c cd /d """ & root & "\desktop-app"" && npm start"
shell.Run cmdDesktop, 0, False   ' también oculto

' Listo: el backend queda corriendo oculto
' y la ventana de Electron aparece como app normal
