#!/bin/bash
export PATH="/home/jrvs/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

/home/jrvs/.local/bin/agy --dangerously-skip-permissions --print "Fetch the Daily and Weekly Bias from the TradingView indicator 'CRT + Daily Bias - Milana Trades' using the tradingview MCP tools. Extract the Daily and Weekly 'DIRECTION' and 'REASON' from the table. Format the text nicely and send it to Telegram chat ID -1003933643777 using the Bot Token '8921795283:AAE-_7aw5xZadlMOsJuqK-mhvM-9DkLXHjo' via a python script using requests. Make sure the message is formatted neatly." >> /home/jrvs/.pm2/logs/daily_bias_cron.log 2>&1
