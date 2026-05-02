#!/bin/bash
# Wrapper script to run JobSpy with proper library paths

# Add Nix-provided libstdc++ to library path
export LD_PRELOAD=/lib/x86_64-linux-gnu/libstdc++.so.6

# Run the Flask app
exec python3 /home/runner/workspace/jobspy_service/app.py
