#!/bin/bash
# scripts/apply_tier.sh

PROJECT_DIR=$(pwd)
INSTANCE_SUFFIX=$1

# Try to get tier from settings.json
SETTINGS_FILE="${PROJECT_DIR}/config/settings.json"

if [ -f "$SETTINGS_FILE" ]; then
    TIER=$(python3 -c "import json, sys; f=open('${SETTINGS_FILE}'); print(json.load(f).get('subscriptionTier', 'starter'))" 2>/dev/null)
else
    echo "⚠️ settings.json not found! Assuming 'starter' tier."
    TIER="starter"
fi

if [ -z "$TIER" ] || [ "$TIER" == "None" ]; then
    TIER="starter"
fi

echo "🔄 Applying services for tier: $TIER (Instance: ${INSTANCE_SUFFIX:-default})"

# Note: on starter, we stop ai-bot and telegram-bot
if [ "$TIER" == "starter" ]; then
    echo "🛑 Stopping AI Bot (Not available on starter tier)"
    sudo systemctl stop ai-bot${INSTANCE_SUFFIX} || true
    sudo systemctl disable ai-bot${INSTANCE_SUFFIX} || true
    
    echo "🛑 Stopping Telegram Bot (Not available on starter tier)"
    sudo systemctl stop telegram-bot${INSTANCE_SUFFIX} || true
    sudo systemctl disable telegram-bot${INSTANCE_SUFFIX} || true

elif [ "$TIER" == "business" ]; then
    echo "✅ Starting AI Bot (Available on business tier)"
    sudo systemctl enable ai-bot${INSTANCE_SUFFIX} || true
    sudo systemctl start ai-bot${INSTANCE_SUFFIX} || true
    
    echo "🛑 Stopping Telegram Bot (Not available on business tier)"
    sudo systemctl stop telegram-bot${INSTANCE_SUFFIX} || true
    sudo systemctl disable telegram-bot${INSTANCE_SUFFIX} || true

elif [ "$TIER" == "pro" ]; then
    echo "✅ Starting AI Bot (Available on pro tier)"
    sudo systemctl enable ai-bot${INSTANCE_SUFFIX} || true
    sudo systemctl start ai-bot${INSTANCE_SUFFIX} || true
    
    echo "🛑 Telegram Bot is temporarily disabled by admin"
    sudo systemctl stop telegram-bot${INSTANCE_SUFFIX} || true
    sudo systemctl disable telegram-bot${INSTANCE_SUFFIX} || true
else
    echo "⚠️ Unknown tier '$TIER', defaulting to starter"
    sudo systemctl stop ai-bot${INSTANCE_SUFFIX} || true
    sudo systemctl stop telegram-bot${INSTANCE_SUFFIX} || true
fi

echo "✅ Tier application complete!"
