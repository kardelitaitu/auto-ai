@echo off
echo Stopping LLM Model...
docker model unload ai/qwen3-vl:4B-UD-Q4_K_XL
echo Model stopped.
exit