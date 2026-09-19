!macro customInstall
  CreateDirectory "$APPDATA\Incoming Warehouse"

  IfFileExists "$APPDATA\Incoming Warehouse\incoming-warehouse.db" skip_db 0
    IfFileExists "$INSTDIR\resources\resources\data\incoming-warehouse.db" 0 skip_db
      CopyFiles /SILENT "$INSTDIR\resources\resources\data\incoming-warehouse.db" "$APPDATA\Incoming Warehouse\incoming-warehouse.db"
  skip_db:

  IfFileExists "$APPDATA\Incoming Warehouse\login.txt" skip_login 0
    FileOpen $0 "$APPDATA\Incoming Warehouse\login.txt" w
    FileWrite $0 "Incoming Warehouse$\r$\nUsername: admin$\r$\nPassword: admin123$\r$\n"
    FileClose $0
  skip_login:

  IfFileExists "$APPDATA\Incoming Warehouse\config.json" skip_config 0
    FileOpen $1 "$APPDATA\Incoming Warehouse\config.json" w
    FileWrite $1 "{$\r$\n"
    FileWrite $1 "  $\"gateway$\": { $\"enabled$\": true, $\"autoStart$\": false },$\r$\n"
    FileWrite $1 "  $\"odoo$\": { $\"baseUrl$\": $\"$\", $\"iotApiKey$\": $\"$\" },$\r$\n"
    FileWrite $1 "  $\"cloud$\": { $\"serverUrl$\": $\"$\", $\"syncApiKey$\": $\"$\", $\"stationId$\": $\"$\" },$\r$\n"
    FileWrite $1 "  $\"database$\": {},$\r$\n"
    FileWrite $1 "  $\"jwtSecret$\": $\"$\",$\r$\n"
    FileWrite $1 "  $\"gatewayApiKey$\": $\"$\",$\r$\n"
    FileWrite $1 "  $\"adminInitialPassword$\": $\"admin123$\"$\r$\n"
    FileWrite $1 "}$\r$\n"
    FileClose $1
  skip_config:
!macroend
