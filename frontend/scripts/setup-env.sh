#!/bin/bash

# Environment Setup Script
# This script helps set up environment variables for the React application

echo "🔧 Setting up environment configuration..."

# Check if .env file already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 0
    fi
fi

# Copy the example file
if [ -f "docs/env-example" ]; then
    cp docs/env-example .env
    echo "✅ Created .env file from template"
else
    echo "❌ Template file docs/env-example not found"
    exit 1
fi

# Make the file writable
chmod 644 .env

echo "📝 Environment file created successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Edit .env file to customize your configuration"
echo "2. Update VITE_API_BASE_URL if needed"
echo "3. Run 'npm run dev' or 'bun run dev' to start development"
echo ""
echo "📖 For more information, see docs/environment-setup.md"
