import os
import logging
from telethon import TelegramClient, events
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Get API credentials from .env
API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
SESSION_NAME = os.getenv('SESSION_NAME', 'listener_session')

if not API_ID or not API_HASH:
    logger.error("API_ID and API_HASH must be set in the .env file.")
    exit(1)

# Initialize the Telegram Client
# We use a file-based session so it persists across container restarts.
client = TelegramClient(SESSION_NAME, int(API_ID), API_HASH)

@client.on(events.NewMessage)
async def handle_new_message(event):
    """
    Listener function that triggers on every new message.
    """
    # Optional: Filter by specific chat IDs
    # if event.chat_id not in [-100123456789]:
    #     return
    
    sender = await event.get_sender()
    sender_name = getattr(sender, 'username', None) or getattr(sender, 'title', None) or getattr(sender, 'first_name', None) or "Unknown"
    
    logger.info(f"New message from {sender_name} (ID: {event.chat_id}): {event.text}")
    
    # TODO: Add your custom logic here (e.g., signal parsing, forwarding, saving to DB)

async def main():
    logger.info("Starting Telegram Listener User Bot...")
    
    # The client will start and prompt for phone number/code on first interactive run.
    # On subsequent runs (in detached Docker mode), it uses the .session file.
    await client.start()
    
    # Get info about the logged-in user
    me = await client.get_me()
    logger.info(f"Logged in successfully as {me.username or me.first_name}")
    
    logger.info("Listening for messages...")
    
    # Run the client until it's manually disconnected or the container stops
    await client.run_until_disconnected()

if __name__ == '__main__':
    # Run the client loop
    with client:
        client.loop.run_until_complete(main())
