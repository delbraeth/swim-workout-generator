#!/bin/bash
# Remove git lock file and push to GitHub
cd "$(dirname "$0")"
rm -f .git/index.lock
echo "Lock removed."
git push origin main
echo "Done! Check https://delbraeth.github.io/swim-workout-generator"
read -p "Press Enter to close..."
