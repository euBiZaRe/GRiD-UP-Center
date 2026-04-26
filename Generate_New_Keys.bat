@echo off
set /p num="How many keys would you like to generate? "
python scripts/generate_keys.py %num%
pause
