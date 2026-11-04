"""Parse student Python without executing it; check the practice's syntax target.
Simulation checks movement/outcomes; this check only checks the requested construct.
"""
import ast,sys
index=int(sys.argv[1]); code=sys.stdin.read()
try: tree=ast.parse(code)
except (SyntaxError,ValueError,RecursionError):
    print('代码还不能作为 Python 解析，请先修正报错行。');sys.exit(1)
nodes=list(ast.walk(tree))
def callname(n):
    return n.func.attr if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) else ''
def has_motion(block): return any(callname(n).startswith('move') for n in ast.walk(block))
def require(ok,msg):
    if not ok: print(msg);sys.exit(1)
if index in [7,8]:
    name='steps' if index==7 else 'remaining'
    require(any(callname(n)=='moveRight' and any(isinstance(a,ast.Name) and a.id==name for a in n.args) for n in nodes),'请把 '+name+' 变量传给移动命令，不要直接填写算好的步数。')
    if index==8: require(any(isinstance(n,ast.BinOp) and isinstance(n.op,ast.Sub) for n in nodes),'请用减法算出剩余格数。')
if index in [9,10,11,12,20]:
    require(any(isinstance(n,ast.If) and has_motion(n) for n in nodes),'请用 if 决定是否移动，不要直接写固定路线。')
if index in [10,11,12,20]: require(any(isinstance(n,ast.If) and n.orelse for n in nodes),'本关需要 else 分支来处理另一种情况。')
if index==11: require(any(isinstance(n,ast.BoolOp) and isinstance(n.op,ast.And) for n in nodes),'本关练习 and，请用它连接两个条件。')
if index==12: require(any(isinstance(n,ast.If) and n.orelse and isinstance(n.orelse[0],ast.If) for n in nodes),'请使用 if / elif / else 判断三档。')
if index in [13,14,15,16,21]:
    require(any(isinstance(n,ast.For) and has_motion(n) for n in nodes),'本关练习 for，请把移动命令放进 for 循环。')
if index in [17,18,19,20,21]:
    require(any(isinstance(n,ast.While) and has_motion(n) for n in nodes),'本关练习 while，请把移动命令放进 while 循环。')
