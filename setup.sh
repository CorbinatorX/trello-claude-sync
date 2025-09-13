#!/bin/bash

# RaveHub Trello Integration Setup Script
# This script helps set up the Trello MCP integration for development workflow

set -e  # Exit on any error

echo "🚀 Setting up RaveHub Trello Integration..."

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: Please run this script from the dev-tools/trello-integration directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup environment file if it doesn't exist
if [[ ! -f ".env" ]]; then
    echo "⚙️ Creating environment file..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo "📝 Please edit .env with your Trello API credentials:"
    echo "   - TRELLO_API_KEY: Get from https://trello.com/app-key"
    echo "   - TRELLO_TOKEN: Generate from the authorize link shown on the API key page"
    echo "   - TRELLO_BOARD_ID: Found in your board URL"
else
    echo "✅ .env file already exists"
fi

# Build the project
echo "🔨 Building TypeScript project..."
npm run build

# Check if kocakli/Trello-Desktop-MCP exists in common locations
MCP_SERVER_PATH=""
POSSIBLE_PATHS=(
    "../../../Trello-Desktop-MCP"
    "../../Trello-Desktop-MCP"
    "../Trello-Desktop-MCP"
    "$HOME/Trello-Desktop-MCP"
    "$HOME/git/Trello-Desktop-MCP"
)

for path in "${POSSIBLE_PATHS[@]}"; do
    if [[ -d "$path" && -f "$path/package.json" ]]; then
        MCP_SERVER_PATH="$path"
        break
    fi
done

if [[ -n "$MCP_SERVER_PATH" ]]; then
    echo "✅ Found kocakli/Trello-Desktop-MCP at: $MCP_SERVER_PATH"

    # Check if it's built
    if [[ ! -f "$MCP_SERVER_PATH/dist/index.js" ]]; then
        echo "🔨 Building Trello MCP server..."
        (cd "$MCP_SERVER_PATH" && npm install && npm run build)
    fi

    echo "📋 Claude Desktop config should use:"
    echo "   \"command\": \"node\""
    echo "   \"args\": [\"$(realpath "$MCP_SERVER_PATH")/dist/index.js\"]"
else
    echo "⚠️  kocakli/Trello-Desktop-MCP not found in common locations"
    echo "   Please install it manually:"
    echo "   git clone https://github.com/kocakli/Trello-Desktop-MCP.git"
    echo "   cd Trello-Desktop-MCP"
    echo "   npm install && npm run build"
fi

echo ""
echo "🎉 Setup completed! Next steps:"
echo ""
echo "1. 📝 Edit .env with your Trello credentials"
echo "2. 🔧 Configure Claude Desktop with the MCP server (see README.md)"
echo "3. 🧪 Test the connection: npm start test"
echo "4. 🔄 Test sync with sample tasks: npm start sync"
echo ""
echo "📚 For detailed setup instructions, see README.md"
echo ""
echo "✨ Happy syncing with Trello!"