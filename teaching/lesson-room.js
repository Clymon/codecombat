// Durable classroom orchestration. It never writes free-practice progress.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { course, tasks, hints: templates } = require('./lesson-curriculum')
const root = () => path.resolve(process.env.TEACHING_STATE_DIR || path.join(__dirname, 'state'))
const read = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { if (e.code === 'ENOENT') return null; throw e } }
function write (file, data) {
  const temp = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp'
  fs.mkdirSync(path.dirname(file), { recursive: true })
  try { fs.writeFileSync(temp, JSON.stringify(data), { mode: 0o600 }); fs.renameSync(temp, file) } catch (error) { throw new (require('./student-accounts').PersistenceError)(error) } finally { fs.rmSync(temp, { force: true }) }
}
class RoomError extends Error { constructor (status, message) { super(message); this.status = status } }
function load () { return read(path.join(root(), 'lesson-room.json')) || { id: null, status: 'waiting', revision: 0, students: {}, hints: [] } }
function save (room, bump = false) { if (bump) room.revision++; write(path.join(root(), 'lesson-room.json'), room); return room }
function requireLive (room) { if (room.status !== 'live') throw new RoomError(409, '当前没有正在进行的课堂。') }
function control (room, teacher, revision) {
  if (room.controller !== teacher.id) throw new RoomError(409, '此设备目前仅查看，请先接管课堂。')
  if (Number(revision) !== room.revision) throw new RoomError(409, '课堂状态已经更新，请查看最新状态后再操作。')
}
function latestAssignment (room, id) {
  return (room.assignments || []).findLast(a => a.targets === 'all' || a.targets.includes(id))
}
function offer (student, assignment) {
  student.offeredTask = assignment.task
  student.offeredAssignmentId = assignment.id
}
function join (id) {
  const room = load()
  if (room.status !== 'live' || room.students[id]) return room
  const assignment = latestAssignment(room, id)
  room.students[id] = { task: assignment?.task || Object.keys(course.groups[room.group || 0].tasks)[0], attempt: 1, results: {}, assisted: {}, completed: false, pending: false, lastError: '', joinedAt: Date.now() }
  if (assignment) offer(room.students[id], assignment)
  return save(room)
}
function command (teacher, input) {
  let room = load()
  if (input.action === 'start') {
    if (room.status === 'live') throw new RoomError(409, '课堂已经开始，请先结束当前课堂。')
    if (Number(input.revision) !== room.revision) throw new RoomError(409, '课堂状态已更新，请刷新。')
    if (room.id) write(path.join(root(), 'lesson-archive', room.id + '.json'), room)
    room = { id: crypto.randomBytes(12).toString('hex'), status: 'live', revision: room.revision, controller: teacher.id, controllerUser: teacher.user, courseId: course.id, group: 0, phase: 'present', paused: true, gathered: true, startedAt: Date.now(), students: {}, hints: [], assignments: [] }
    return save(room, true)
  }
  requireLive(room)
  if (input.action === 'takeover') {
    room.controller = teacher.id; room.controllerUser = teacher.user
    return save(room, true)
  }
  control(room, teacher, input.revision)
  if (input.action === 'phase') {
    if (!['present', 'explain', 'practice', 'review'].includes(input.phase)) throw new RoomError(400, '未知课堂环节。')
    room.phase = input.phase; room.paused = input.phase !== 'practice'
    if (input.phase === 'practice') room.gathered = false
  } else if (input.action === 'gather') { room.gathered = true; room.paused = true; room.phase = 'explain' } else if (input.action === 'pause') room.paused = true
  else if (input.action === 'resume') { room.paused = false; room.gathered = false; room.phase = 'practice' } else if (input.action === 'advance') {
    if (room.group + 1 >= course.groups.length) throw new RoomError(409, '已经是最后一组，可以进入总结或结束课堂。')
    room.group++; room.phase = 'explain'; room.paused = true
  } else if (input.action === 'end') { room.status = 'ended'; room.paused = true; room.endedAt = Date.now() } else if (input.action === 'assign') {
    if (!Object.hasOwn(tasks, input.task)) throw new RoomError(400, '请选择有效任务。')
    const all = input.targets === 'all'
    if (!all && (!Array.isArray(input.targets) || !input.targets.length || input.targets.length > 200 || input.targets.some(id => typeof id !== 'string' || !/^\d{4,20}$/.test(id)))) throw new RoomError(400, '请填写4—20位数字学号；最多200人。学生无需提前进入课堂。')
    const note = typeof input.note === 'string' ? input.note.trim() : ''
    if (note.length > 400) throw new RoomError(400, '任务说明最多400字。')
    const assignment = { id: crypto.randomBytes(12).toString('hex'), task: input.task, targets: all ? 'all' : [...new Set(input.targets)], note, publishedAt: Date.now(), accepted: {} }
    room.assignments ||= []; room.assignments.push(assignment)
    for (const [id, p] of Object.entries(room.students)) {
      if (!all && !assignment.targets.includes(id)) continue
      if (['independent', 'recheck', 'challenge'].includes(input.task) && !p.results.independent?.independent && !p.results.recheck?.independent) p.pending = true
      // Publication is independent of location, activity and attendance. Accept later.
      offer(p, assignment)
    }
    if (all) { const group = course.groups.findIndex(g => Object.hasOwn(g.tasks, input.task)); if (group >= 0) room.group = group }
  } else if (input.action === 'hint') {
    const ids = input.targets === 'all' ? Object.keys(room.students) : input.targets
    if (!Array.isArray(ids) || !ids.length || ids.length > 200 || ids.some(id => !room.students[id])) throw new RoomError(400, '请先选择已进入课堂的学生。')
    if (![1, 2, 3].includes(Number(input.level))) throw new RoomError(400, '提示级别须为1、2或3。')
    const text = typeof input.text === 'string' ? input.text.trim() : ''; const code = typeof input.code === 'string' ? input.code.trim() : ''
    if (text.length > 800 || code.length > 1200) throw new RoomError(400, '提示太长，请保留一个明确操作。')
    for (const id of new Set(ids)) {
      const p = room.students[id]; const template = templates(p.task)[Number(input.level) - 1]
      room.hints.push({ id: crypto.randomBytes(12).toString('hex'), studentId: id, task: p.task, attempt: p.attempt || 1, level: Number(input.level), text: text || template.text, code: code || template.code || '', target: template.target, sentAt: Date.now(), deliveredAt: null, seenAt: null })
      if ((Number(input.level) >= 2 || code)) p.assisted[p.task] = true
    }
  } else throw new RoomError(400, '未知课堂操作。')
  return save(room, true)
}
function studentView (id) {
  const room = load(); const p = room.students[id]
  const next = p ? nextTask(p) : null
  const assignment = (room.assignments || []).find(a => a.id === p?.offeredAssignmentId)
  return { studentId: id, id: room.id, status: room.status, revision: room.revision, title: course.title, groupTitle: (course.groups.find(g => Object.hasOwn(g.tasks, p?.offeredTask || p?.task)) || course.groups[room.group || 0]).title, phase: room.phase, gathered: !!room.gathered, paused: room.paused !== false, task: p ? { id: p.task, ...tasks[p.task], note: p.assignmentNote || '' } : null, reviewTasks: room.status === 'ended' && p ? Object.keys(p.results).filter(k => p.results[k].complete).map(id => ({ id, title: tasks[id].title })) : [], progress: p ? Object.entries(p.results).filter(([, result]) => result.complete).map(([id, result]) => ({ id, title: tasks[id].title, independent: result.independent, assisted: result.assisted })) : [], result: p?.results[p.task], pending: p?.pending || false, offeredTask: p?.offeredTask ? { id: p.offeredTask, ...tasks[p.offeredTask], assignmentId: p.offeredAssignmentId, note: assignment?.note || '' } : null, next: next ? { ...next, detail: { id: next.task, ...tasks[next.task] } } : null, hints: room.hints.filter(h => h.studentId === id && h.task === p?.task && (h.attempt || 1) === (p.attempt || 1)).map(({ studentId, ...h }) => h) }
}
function nextTask (p) {
  if (p.offeredTask) return { task: p.offeredTask, label: `老师安排：${tasks[p.offeredTask].title}` }
  return null // Optional practice is assigned explicitly; completion never queues a clone of this mission.
}
function move (id, roomId, action, assignmentId) {
  const room = load(); requireLive(room)
  if (room.id !== roomId || !room.students[id]) throw new RoomError(409, '课堂已改变，请回到本节课。')
  if (room.paused) throw new RoomError(409, '老师正在讲解，请稍后继续。')
  const p = room.students[id]
  if (assignmentId && assignmentId !== p.offeredAssignmentId) throw new RoomError(409, '老师已经更新任务，请查看任务板上的最新安排后再出发。')
  const next = action === 'help' ? 'remedial' : action === 'independent' && p.task === 'basic' ? 'independent' : nextTask(p)?.task
  if (!next) throw new RoomError(409, '请先完成当前任务。')
  if (action === 'next') {
    const assignment = (room.assignments || []).find(a => a.id === p.offeredAssignmentId)
    if (assignment) { assignment.accepted[id] = Date.now(); p.acceptedAssignmentId = assignment.id; p.assignmentNote = assignment.note }
    // Returning to an assigned task preserves code, completion and assistance.
    p.task = next; p.lastError = ''
  } else {
    p.task = next; p.assignmentNote = ''; p.attempt = (p.attempt || 1) + 1; p.lastError = ''; delete p.results[next]; delete p.assisted[next]
    const file = progressFile(room.id, id); const progress = read(file) || {}; delete progress[tasks[next].slug]; write(file, progress)
  }
  delete p.offeredTask; delete p.offeredAssignmentId
  save(room); return `/play/level/${tasks[next].slug}?codeLanguage=python`
}
function acknowledge (id, roomId, hintId, kind) {
  const room = load()
  if (room.id !== roomId || !['delivered', 'seen'].includes(kind)) throw new RoomError(409, '提示已经过期。')
  const hint = room.hints.find(h => h.id === hintId && h.studentId === id)
  if (!hint) throw new RoomError(404, '提示不存在。')
  if (!hint.deliveredAt) hint.deliveredAt = Date.now()
  if (kind === 'seen') hint.seenAt ||= Date.now()
  return save(room)
}
function access (id, slug, operation = 'open') {
  const room = load()
  if (room.status !== 'live') return null
  const p = room.students[id]
  if (operation === 'save') return { allowed: true, room }
  return { allowed: !room.gathered && p && tasks[p.task].slug === slug, room }
}
function progressFile (roomId, id, review = false) {
  if (!/^[a-f0-9]{24}$/.test(roomId) || !/^\d{4,20}$/.test(id)) throw new RoomError(400, '课堂记录身份无效。')
  return path.join(root(), review ? 'lesson-review' : 'lesson-progress', roomId, id + '.json')
}
function store (roomId, review = false) {
  return { readProgress: id => read(progressFile(roomId, id, review)) || {}, saveProgress: (id, data) => write(progressFile(roomId, id, review), data) }
}
function record (roomId, id, slug, session) {
  const room = load(); if (room.id !== roomId || room.status !== 'live') return
  const p = room.students[id]; if (!p || tasks[p.task].slug !== slug) return
  p.lastError = session.learningFeedback || ''
  if (session.teachingComplete && !room.paused && !p.results[p.task]?.complete) {
    const independent = !['basic', 'remedial', 'challenge'].includes(p.task) && !p.assisted[p.task]
    p.results[p.task] = { complete: true, independent, assisted: !!p.assisted[p.task], at: Date.now() }
    if (independent) p.pending = false
  }
  save(room)
}
function reportError (id, roomId, message) {
  const room = load(); if (room.id !== roomId || !room.students[id]) return
  room.students[id].lastError = String(message || '').slice(0, 500); save(room)
}
function review (id, task) {
  const room = load(); const p = room.students[id]
  if (room.status !== 'ended' || !tasks[task] || !p?.results[task]?.complete) throw new RoomError(403, '只能复习本节已完成的任务。')
  p.reviewTask = task
  save(room)
  return `/play/level/${tasks[task].slug}?codeLanguage=python`
}
function reviewAllowed (id, slug) {
  const room = load(); const p = room.students[id]
  return room.status === 'ended' && tasks[p?.reviewTask]?.slug === slug
}
module.exports = { review, reviewAllowed, RoomError, load, join, command, studentView, nextTask, move, acknowledge, access, store, record, reportError }
