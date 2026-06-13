# BuildPath — Startup Instructions

## Terminal 1 (Backend)
cd ~/Desktop/buildpath-agent
az login
# Select "Azure for Students" (option 1)
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 backend/app.py

## Terminal 2 (Frontend)
cd ~/Desktop/buildpath-agent
npm run dev --prefix frontend

## Open in browser
http://localhost:5173
