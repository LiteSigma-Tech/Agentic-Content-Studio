$project = "C:\Users\HP\Projects\Work\Agentic-Content-Studio-master"
$venv = "$project\venv\Scripts\Activate.ps1"

#run .\start-all.ps1 
#powershell -ExecutionPolicy Bypass -File .\start-all.ps1
# Start backend services in new windows
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $project; . $venv; uvicorn platform_core.app:app --reload --host 127.0.0.1 --port 8005"
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $project; . $venv; uvicorn model_gateway.api:app --reload --host 127.0.0.1 --port 8001"
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $project; . $venv; uvicorn audio_studio.api:app --reload --host 127.0.0.1 --port 8002"
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $project; . $venv; uvicorn lead_gen.api:app --reload --host 127.0.0.1 --port 8003"
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $project; . $venv; uvicorn agent_runtime.api:app --reload --host 127.0.0.1 --port 8004"

# Start frontend
Start-Process powershell -ArgumentList "-NoExit","-Command","cd $project\frontend-app; npm run dev"