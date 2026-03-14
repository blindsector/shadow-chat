import os

folders = [
    "server",
    "server/controllers",
    "server/routes",
    "server/services",
    "client",
    "data"
]

files = [
    "server/server.py",
    "server/controllers/auth_controller.py",
    "server/controllers/message_controller.py",
    "server/controllers/user_controller.py",
    "server/routes/auth_routes.py",
    "server/routes/message_routes.py",
    "server/routes/user_routes.py",
    "server/services/db.py",
    "server/services/session.py",
    "client/index.html",
    "client/style.css",
    "client/app.js"
]

for folder in folders:
    os.makedirs(folder, exist_ok=True)

for file in files:
    with open(file, "w") as f:
        pass

print("Project structure created.")