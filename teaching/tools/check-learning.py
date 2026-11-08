"""Validate Python syntax without executing it. World outcomes decide success."""
import ast
import sys

code = sys.stdin.read()
try:
    ast.parse(code)
except (SyntaxError, ValueError, RecursionError):
    print("代码还不能作为 Python 解析，请先修正报错行。")
    sys.exit(1)
