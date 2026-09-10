# Telegram Listener Bot Setup

The Telegram listener bot has been successfully created in the `telegram-bot` folder, complete with a Dockerfile for easy deployment on your GCP VM.

## What Was Created
- `main.py`: The core listener using Telethon. It currently listens to all incoming messages and logs them.
- `requirements.txt`: Python dependencies (`telethon`, `python-dotenv`).
- `.env.example`: A template for your API keys.
- `Dockerfile`: The containerization blueprint.

## Next Steps for Deployment

To run this on your GCP VM, follow these steps:

### 1. Setup API Credentials
1. Go to [my.telegram.org](https://my.telegram.org) and get your `API_ID` and `API_HASH`.
2. On your VM (or locally before uploading), copy `.env.example` to `.env`.
3. Add your credentials inside the `.env` file.

### 2. Initial Run & Login
Because this is a user bot, Telegram requires a one-time login with your phone number and an SMS/app code. We must do this interactively first:

```bash
cd telegram-bot
# Build the image
docker build -t telegram-listener .
# Run interactively (to enter the login code)
docker run -it -v $(pwd):/app --env-file .env telegram-listener
```
Follow the prompts in the terminal to enter your phone number and the login code. This will generate a `listener_session.session` file. Once logged in, hit `Ctrl+C` to stop the container.

> **IMPORTANT**
> The `-v $(pwd):/app` flag is critical during the first run. It ensures the generated `.session` file is saved to your host machine so it survives container restarts!

### 3. Run in the Background
Now that the session file is created, you can run the bot persistently in the background:

```bash
docker run -d --name my-telegram-bot --restart unless-stopped -v $(pwd):/app --env-file .env telegram-listener
```

You can view the live logs anytime with:
```bash
docker logs -f my-telegram-bot
```
