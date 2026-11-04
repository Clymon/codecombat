"""Parse student Python without executing it; check the practice's syntax target.
Simulation checks movement/outcomes; this check only checks the requested construct.
"""
import ast,sys,json
from pathlib import Path
index=int(sys.argv[1]); code=sys.stdin.read()
try: tree=ast.parse(code)
except (SyntaxError,ValueError,RecursionError):
    print('代码还不能作为 Python 解析，请先修正报错行。');sys.exit(1)
nodes=list(ast.walk(tree))
def callname(n):
    return n.func.attr if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) else n.func.id if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) else ''
def has_motion(block): return any(callname(n).startswith('move') for n in ast.walk(block))
def require(ok,msg):
    if not ok: print(msg);sys.exit(1)
contract=json.loads((Path(__file__).resolve().parent.parent/'learning-contracts.json').read_text()).get(str(index), {})
# Count Python statements, not physical lines. Blank lines/comments disappear in AST.
# else/elif headers count once; multiline expressions remain one statement.
count=sum(isinstance(n,ast.stmt) for n in nodes)+sum(isinstance(n,(ast.If,ast.For,ast.While)) and bool(n.orelse) and not (len(n.orelse)==1 and isinstance(n.orelse[0],ast.If)) for n in nodes)
maximum=contract.get('maxStatements')
require(not maximum or count<=maximum, f'本关最多 {maximum} 行有效代码，你写了 {count} 行。空行和注释不计，分号合并仍分别计数。')
for loop in contract.get('loops',[]):
    require(any(isinstance(n,ast.For if loop=='for' else ast.While) for n in nodes),f'请使用 {loop} 循环完成本关。')
for name in contract.get('calls',[]):
    require(any(callname(n)==name for n in nodes),f'请实际使用 {name} 完成本关。')
def inspect(block, context=()):
    for n in block:
        if isinstance(n,(ast.For,ast.While,ast.If)):
            kind='for' if isinstance(n,ast.For) else 'while' if isinstance(n,ast.While) else 'if'
            inspect(n.body,context+(kind,));inspect(n.orelse,context+('if',) if kind=='if' else context)
        else:
            for call in ast.walk(n):
                name='say' if callname(call)=='print' else callname(call)
                required=contract.get('inside',{}).get(name,'')
                for kind in filter(None,required.split(',')):
                    require(kind in context,f'请把 {name} 放进 {kind} 内执行。')
inspect(tree.body)
if index in [30,31,32,33]:
    require(any(callname(n)=='attack' and n.args and isinstance(n.args[0],ast.Name) for n in nodes),'请把查找到的敌人变量交给 attack，不要把名字写死。')
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

if index in [24,29]:
    require(any(isinstance(n, ast.For) and has_motion(n) and any(callname(c) in ['say', 'print'] for c in ast.walk(n)) for n in nodes), '请把移动和发言放进同一个 for 循环，重复完整动作组。')
if index in [25,33]:
    require(any(isinstance(n, ast.While) and any(callname(c) == 'findNearestEnemy' for c in ast.walk(n)) for n in nodes), '请在 while 循环中重新寻找敌人，目标不会自动更新。')
    require(any(isinstance(n, ast.If) and any(callname(c) == 'attack' for c in ast.walk(n)) for n in nodes), '请用 if 判断有敌人以后再攻击。')
