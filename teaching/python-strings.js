// Compatibility for the bundled Python interpreter, scoped to local Python levels.
// Preserve source locations and evaluate operands once; this never awards goals.
const esprima = require('esprima')
const methods = ['strip', 'lstrip', 'rstrip', 'upper', 'lower', 'find', 'index', 'count', 'startswith', 'endswith', 'replace']
const methodFunction = esprima.parse(`(function(s, method, args) {
  if (typeof s !== 'string') return s[method].apply(s,args);
  s=String(s);
  var a=args[0], b=args[1], result='', i=0, n=0;
  if (method === 'upper') return String.prototype.toUpperCase.call(s);
  if (method === 'lower') return String.prototype.toLowerCase.call(s);
  if (method === 'strip' || method === 'lstrip' || method === 'rstrip') {
    var chars = a == null ? ' \\t\\n\\r\\v\\f' : a;
    if (typeof chars !== 'string') throw new TypeError('strip 的参数应是字符串');
    var start=0, end=s.length;
    if (method !== 'rstrip') while(start<end && String.prototype.indexOf.call(chars,s[start])>=0) start++;
    if (method !== 'lstrip') while(end>start && String.prototype.indexOf.call(chars,s[end-1])>=0) end--;
    return String.prototype.slice.call(s,start,end);
  }
  if (typeof a !== 'string') throw new TypeError('查找或替换的内容应是字符串');
  if (method === 'replace') {
    if (typeof b !== 'string') throw new TypeError('替换后的内容应是字符串');
    var limit=args[2] == null || args[2]<0 ? Infinity : args[2];
    if (a === '') {
      for(i=0;i<=s.length;i++) { if(n<limit) {result+=b;n++;} if(i<s.length) result+=s[i]; }
      return result;
    }
    while(i<s.length) {
      if(n<limit && String.prototype.slice.call(s,i,i+a.length)===a) { result+=b;i+=a.length;n++; }
      else {result+=s[i];i++;}
    }
    return result;
  }
  var start=b==null?0:b, end=args[2]==null?s.length:args[2];
  if(start<0)start=Math.max(0,s.length+start);
  if(end<0)end=Math.max(0,s.length+end);
  var part=String.prototype.slice.call(s,start,Math.max(start,end));
  if(method==='startswith')return start<=s.length && String.prototype.slice.call(part,0,a.length)===a;
  if(method==='endswith')return start<=s.length && String.prototype.slice.call(part,part.length-a.length)===a;
  var found=start>s.length?-1:String.prototype.indexOf.call(part,a);
  if(method==='index' && found<0)throw new Error('ValueError: substring not found');
  if(method==='find' || method==='index')return found<0?-1:start+found;
  if(a==='')return start>s.length?0:part.length+1;
  while((i=String.prototype.indexOf.call(part,a,i))>=0){n++;i+=a.length;}
  return n;
})`).body[0].expression
const multiplyFunction = esprima.parse(`(function(a,b) {
  if(typeof a !== 'string' && typeof b !== 'string') return __pythonRuntime.ops.multiply(a,b);
  var s=typeof a === 'string'?a:b, n=typeof a === 'string'?b:a;
  if(typeof n === 'boolean') n=n?1:0;
  if(typeof n !== 'number' || n%1!==0)throw new TypeError('字符串只能乘整数');
  if(n*s.length>100000)throw new Error('重复后的字符串过长，请减小次数');
  var result=''; for(var i=0;i<n;i++)result+=s;
  return result;
})`).body[0].expression
const containsFunction = esprima.parse(`(function(a,b) {
  if(typeof b !== 'string')return __pythonRuntime.ops.in(a,b);
  if(typeof a !== 'string')throw new TypeError('字符串的 in 左边也应是字符串');
  return String.prototype.indexOf.call(b,a)>=0;
})`).body[0].expression
function rewritePythonStrings (ast) {
  const copy = value => {
    const result = JSON.parse(JSON.stringify(value))
    function mark (n) { if (!n || typeof n !== 'object') return; n.nonUserCode = true; for (const v of Object.values(n)) { if (Array.isArray(v))v.forEach(mark); else if (v && typeof v === 'object')mark(v) } }
    mark(result); return result
  }
  function visit (node) {
    if (!node || typeof node !== 'object' || node.teachingStringCompatibility) return
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'range') continue
      if (Array.isArray(value))value.forEach(visit); else if (value && typeof value === 'object')visit(value)
    }
    if (node.type !== 'CallExpression') return
    const c = node.callee
    if (c?.type !== 'MemberExpression' || c.computed) return
    const name = c.property?.name
    if (name === 'multiply' && c.object?.property?.name === 'ops' && c.object?.object?.name === '__pythonRuntime') {
      node.callee = copy(multiplyFunction); node.teachingStringCompatibility = true
    } else if (name === 'in' && c.object?.property?.name === 'ops' && c.object?.object?.name === '__pythonRuntime') {
      node.callee = copy(containsFunction); node.teachingStringCompatibility = true
    } else if (methods.includes(name)) {
      node.arguments = [c.object, { type: 'Literal', value: name }, { type: 'ArrayExpression', elements: node.arguments }]
      node.callee = copy(methodFunction); node.teachingStringCompatibility = true
    }
    if (node.teachingStringCompatibility)node.callee.teachingPythonHelper = true
  }
  visit(ast); return ast
}
module.exports = { rewritePythonStrings }
