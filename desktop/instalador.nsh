; Ganchos do instalador do Windows (electron-builder, nsis.include).
;
; Ao atualizar, o instalador desinstala primeiro a versão anterior, e o
; desinstalador apaga a pasta do programa inteira. Até à versão 1.0 era aí,
; ao lado do executável, que ficavam os autosaves e as definições. Por isso:
; antes de desinstalar, copiam-se para uma pasta temporária; depois de
; instalar, voltam para a pasta do programa, e a aplicação, ao arrancar,
; passa-os para a pasta do utilizador (onde ficam daqui em diante, a salvo
; de atualizações). Só se apaga a pasta temporária depois de os ficheiros
; voltarem.

!macro customInit
  Push $0
  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $0 == ""
    ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${EndIf}
  ${If} $0 != ""
    ${If} ${FileExists} "$0\autosaves\*.json"
      CreateDirectory "$TEMP\mapeamento-organizacional-dados\autosaves"
      CopyFiles /SILENT "$0\autosaves\*.json" "$TEMP\mapeamento-organizacional-dados\autosaves"
    ${EndIf}
    ${If} ${FileExists} "$0\definicoes.json"
      CreateDirectory "$TEMP\mapeamento-organizacional-dados"
      CopyFiles /SILENT "$0\definicoes.json" "$TEMP\mapeamento-organizacional-dados"
    ${EndIf}
  ${EndIf}
  Pop $0
!macroend

!macro customInstall
  ${If} ${FileExists} "$TEMP\mapeamento-organizacional-dados\*.*"
    CopyFiles /SILENT "$TEMP\mapeamento-organizacional-dados\*.*" "$INSTDIR"
    RMDir /r "$TEMP\mapeamento-organizacional-dados"
  ${EndIf}
!macroend
