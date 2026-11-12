/* global requestAnimationFrame */
// Original, code-drawn pixel art. No image downloads or game-engine boot in the waiting room.
;(function () {
  const viewport = document.querySelector('#cabin-canvas')
  if (!viewport) return
  const display = viewport.getContext('2d')
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360
  let portrait = false; let viewHeight = 360
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false
  const scene = document.createElement('canvas'); scene.width = 640; scene.height = 360
  const bg = scene.getContext('2d')
  const $ = s => document.querySelector(s)
  const rect = (c, color, x, y, w, h) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h) }
  const block = (c, x, y, w, h, color, rim = '#45332e') => { rect(c, rim, x - 2, y - 2, w + 4, h + 4); rect(c, color, x, y, w, h); rect(c, '#ffffff18', x, y, w, 2) }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let still = reduced.matches; let state; let connected = false; let mode = 'waiting'; let departing = false; let lastKey = ''; let clock = 0; let lastFrame = 0
  const actor = { x: 560, y: 175, target: 280, targetY: 220, facing: -1 }; let arriving = true; let visit = 0; let nextVisit = 4; let departDone; let doorAction; let freeDoor = false
  const sprite = [
    '       oooooo       ',
    '     ooWWWWWWoo     ',
    '    oWWWwwwwWWW o   ',
    '   oWWWWWWWWWWWoo   ',
    '   oBBBBBBBBBBBBo   ',
    '  oBBbBBBBBBbBBBBo  ',
    '  oBbbBBBbBBbbBBBo  ',
    '  oBBSbbBBSbbbBBBo  ',
    '  oBBSSESSSESSBBBo  ',
    '  oBBSSESSSESSBBBo  ',
    '  oBBSSSSSSSSSBBBo  ',
    '  oBBBSSsSsSSBBBBo  ',
    '  oBBBBoSSSooBBBBo  ',
    '  oBBBBoWWWoBBBBBo  ',
    '  oBBBoWWbWWoBBBBo  ',
    '   oBSoWWbWWoSBBo   ',
    '    oSoWWWWW oSo    ',
    '    ooWbWWWbWoo     ',
    '    oWWbWWWbWWo     ',
    '   oWWWbWWWbWWWo    ',
    '   oWWWWWWWWWWWo    ',
    '   owwwwwwwwwwwo    ',
    '    oWbWWWbWWo      ',
    '     oSSooSSo       ',
    '     oSSooSSo       ',
    '     oooo oooo      ',
    '    oDDDo oDDDo     ',
    '    oooo   oooo     ',
  ]
  const colors = { o: '#23374c', W: '#f3ead3', w: '#c6d9db', B: '#346caf', b: '#78a6d5', S: '#f7d0ae', s: '#d58e84', E: '#203f68', D: '#344c66' }
  function base () {
    rect(bg, '#182e35', 0, 0, 640, 360)
    for (let i = 0; i < 38; i++) { const x = (i * 97 + 11) % 640; const y = (i * 53) % 360; rect(bg, '#24434a', x, y, 4, 2) }
    block(bg, 16, 25, 608, 316, '#624639', '#10232a')
    rect(bg, '#332f30', 25, 34, 590, 300)
    // Warm plaster, wooden wainscoting and individual floorboards.
    rect(bg, '#b58e63', 30, 40, 580, 110)
    for (let y = 44; y < 144; y += 6) for (let x = 35; x < 605; x += 17) rect(bg, '#a77d5725', x + (y % 5), y, 5, 1)
    rect(bg, '#705240', 30, 138, 580, 33)
    for (let x = 32; x < 610; x += 24) { rect(bg, '#513e35', x, 140, 2, 30); rect(bg, '#a37c55', x + 3, 142, 1, 25) }
    rect(bg, '#302c2b', 30, 169, 580, 6)
    for (let row = 0; row < 10; row++) {
      const y = 175 + row * 16
      rect(bg, ['#9c714d', '#a77c52', '#a07650'][row % 3], 30, y, 580, 15)
      for (let x = 30 - (row % 2) * 42; x < 610; x += 84) {
        rect(bg, '#73533e', Math.max(30, x), y, 1, 15)
        rect(bg, '#ba8c5c', Math.max(32, x + 3), y + 2, Math.min(77, 606 - Math.max(32, x + 3)), 1)
        if (x > 30 && x < 560) { rect(bg, '#805d422f', x + 24, y + 7, 34, 1); rect(bg, '#6e503a', x + 6, y + 12, 2, 1) }
      }
    }
    // Timber rafters and supports.
    for (const x of [28, 197, 412, 604]) { rect(bg, '#4c382f', x, 35, 8, 139); rect(bg, '#806044', x + 2, 39, 2, 128) }
    rect(bg, '#45332c', 24, 30, 592, 13); rect(bg, '#986b44', 29, 33, 581, 4)
    rect(bg, '#523b2e', 21, 333, 598, 10); rect(bg, '#b28758', 25, 333, 590, 3)
    // Window recess; the animated garden is painted inside it below.
    block(bg, 247, 54, 135, 88, '#473f36'); block(bg, 254, 60, 121, 73, '#80b6b0')
    rect(bg, '#644737', 242, 139, 145, 6); rect(bg, '#c29460', 242, 136, 145, 4)
    // Bookshelf, with an intentionally varied library.
    block(bg, 43, 68, 61, 97, '#553e32'); rect(bg, '#352e2b', 48, 73, 51, 84)
    const bookColors = ['#738b71', '#ae654e', '#bc9c60', '#64878a', '#c3b693']
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 7; col++) { const x = 50 + col * 6; const h = 15 + (col * 3 + row) % 7; rect(bg, bookColors[(col + row) % 5], x, 94 + row * 27 - h, 5, h); rect(bg, '#e1bf803f', x + 1, 91 + row * 27, 3, 1) }
      rect(bg, '#a87c50', 47, 95 + row * 27, 53, 4)
    }
    // Fireplace masonry and mantel.
    rect(bg, '#62433655', 110, 166, 86, 12)
    block(bg, 115, 99, 75, 73, '#847568')
    for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) { const x = 116 + col * 18; const y = 101 + row * 14; rect(bg, row % 2 ? '#71675e' : '#968573', x + (row % 2) * 2, y, 15, 11); rect(bg, '#b1a18b', x + 1, y, 12, 1) }
    block(bg, 132, 126, 43, 43, '#352c2a'); rect(bg, '#1d2527', 137, 130, 33, 35)
    block(bg, 108, 94, 90, 8, '#a7774a'); block(bg, 110, 170, 88, 8, '#847262')
    // Mantel clock.
    block(bg, 145, 70, 20, 23, '#5a4133'); block(bg, 149, 74, 12, 12, '#e5c990'); rect(bg, '#6a5036', 154, 76, 1, 6); rect(bg, '#6a5036', 155, 81, 4, 1)
    // Noticeboard, papers and wax seal.
    block(bg, 442, 69, 67, 66, '#76523a'); block(bg, 447, 74, 57, 56, '#b18d57')
    rect(bg, '#e7d3a1', 456, 84, 35, 36); rect(bg, '#95754e', 462, 92, 21, 2); rect(bg, '#b09266', 462, 98, 16, 2); rect(bg, '#b09266', 462, 103, 19, 2); block(bg, 471, 111, 6, 6, '#a65d4c')
    // Doorway has genuine closed/open states.
    block(bg, 535, 84, 57, 88, '#503d32'); rect(bg, '#2b3533', 540, 89, 47, 80)
    // Teal woven rug.
    block(bg, 199, 221, 221, 82, '#547d75', '#70513e'); rect(bg, '#aeb18b', 203, 225, 213, 74); rect(bg, '#426e68', 207, 229, 205, 66)
    for (let i = 0; i < 17; i++) { rect(bg, '#c4ba8d', 205 + i * 12, 221, 5, 2); rect(bg, '#c4ba8d', 205 + i * 12, 301, 5, 2) }
    for (let x = 219; x < 403; x += 20) { rect(bg, '#7a9b83', x, 235, 3, 3); rect(bg, '#7a9b83', x, 286, 3, 3) }
    rect(bg, '#638b79', 265, 255, 80, 19); rect(bg, '#a5b18e', 300, 250, 10, 29); rect(bg, '#a5b18e', 291, 259, 28, 10)
    // Sofa and cushions.
    rect(bg, '#55413555', 51, 304, 114, 9); block(bg, 58, 260, 102, 37, '#8c735c'); block(bg, 61, 251, 95, 28, '#b59169')
    block(bg, 65, 278, 87, 17, '#c6a178'); block(bg, 53, 267, 12, 32, '#907356'); block(bg, 150, 267, 12, 32, '#907356')
    block(bg, 74, 262, 24, 19, '#597d76'); rect(bg, '#91a28a', 78, 265, 16, 2); block(bg, 117, 262, 23, 20, '#bc7456'); rect(bg, '#e4b47d', 127, 264, 2, 15)
    rect(bg, '#473b32', 61, 298, 5, 7); rect(bg, '#473b32', 151, 298, 5, 7)
    // Window desk with open book, candle, tea and chair.
    rect(bg, '#66503b55', 250, 176, 141, 10); block(bg, 260, 153, 121, 12, '#b98b56'); rect(bg, '#6a4b34', 267, 166, 6, 20); rect(bg, '#6a4b34', 369, 166, 6, 20)
    block(bg, 287, 147, 29, 13, '#e7d7b4'); rect(bg, '#9a805a', 301, 148, 1, 11); rect(bg, '#b0a17d', 291, 151, 7, 1); rect(bg, '#b0a17d', 305, 154, 7, 1)
    block(bg, 343, 148, 10, 9, '#ddd2b1'); rect(bg, '#776146', 345, 149, 6, 2); rect(bg, '#c3bb9a', 353, 151, 3, 4)
    block(bg, 307, 178, 26, 10, '#725440'); block(bg, 309, 171, 22, 8, '#9d7950')
    // A low table, folded blanket, brass lamp and potted plants.
    block(bg, 448, 267, 55, 25, '#977147'); rect(bg, '#604731', 452, 293, 4, 11); rect(bg, '#604731', 494, 293, 4, 11)
    rect(bg, '#b6ae8c', 455, 269, 28, 13); rect(bg, '#6b8e86', 456, 272, 27, 3); rect(bg, '#d4c59b', 453, 268, 4, 16); rect(bg, '#d4c59b', 482, 268, 4, 16); rect(bg, '#638879', 461, 271, 4, 3); rect(bg, '#638879', 466, 274, 6, 2); rect(bg, '#ab644c', 476, 277, 3, 3)
    rect(bg, '#a58551', 563, 257, 3, 44); block(bg, 555, 302, 20, 4, '#7c6743'); rect(bg, '#e8bd76', 548, 247, 33, 12); rect(bg, '#f1d598', 552, 239, 25, 9); rect(bg, '#b4864f', 548, 259, 33, 3)
    for (const [x, y] of [[217, 155], [520, 290], [71, 224]]) {
      block(bg, x, y, 15, 16, '#b77b55'); rect(bg, '#d6a575', x - 2, y, 19, 4)
      rect(bg, '#597748', x + 6, y - 24, 3, 25); rect(bg, '#6c9355', x - 4, y - 18, 11, 6); rect(bg, '#8fa86a', x + 8, y - 25, 12, 7); rect(bg, '#557c4c', x + 9, y - 10, 10, 6)
    }
    // Small framed landscape and hanging lamp.
    block(bg, 208, 65, 24, 29, '#70513b'); rect(bg, '#87a19a', 212, 69, 16, 21); rect(bg, '#e4cc8b', 221, 73, 4, 4); rect(bg, '#537568', 212, 82, 16, 8)
    rect(bg, '#4b4033', 408, 40, 2, 17); rect(bg, '#b18c55', 400, 57, 18, 4); rect(bg, '#f5d597', 403, 61, 12, 10); rect(bg, '#775c3f', 400, 71, 18, 3)
  }
  base()
  function paint (t) {
    ctx.drawImage(scene, 0, 0)
    // Moving sky behind a framed window; branches sway outside.
    rect(ctx, '#79aaa7', 257, 63, 115, 67); rect(ctx, '#a9c5ad', 257, 63, 115, 27)
    for (let i = 0; i < 3; i++) { const x = 257 + ((i * 43 + t * 1.5) % 115); rect(ctx, '#d9dcc0', x, 71 + i * 8, Math.min(22, 372 - x), 3) }
    for (let i = 0; i < 6; i++) { const x = 257 + i * 20; rect(ctx, '#628e7b', x, 107 - i % 3 * 6, 20, 23 + i % 3 * 6); rect(ctx, '#497866', x + 4 + Math.round(Math.sin(t + i)), 105 - i % 3 * 6, 12, 25 + i % 3 * 6) }
    rect(ctx, '#e1c186', 312, 62, 4, 70); rect(ctx, '#e1c186', 255, 96, 119, 4)
    for (const x of [251, 364]) { rect(ctx, '#e1c59a', x, 61, 12, 65); rect(ctx, '#ba9b75', x + 4, 62, 2, 63); rect(ctx, '#f0d7ae', x + 9, 62, 2, 60); rect(ctx, '#8c7460', x, 99, 12, 3) }
    // Soft, stepped pools of light (no blur: pixel edges stay crisp).
    rect(ctx, '#ffe8a608', 265, 189, 113, 21); rect(ctx, '#ffe8a608', 260, 210, 126, 12)
    const flame = Math.floor(t * 6)
    rect(ctx, '#e98c3316', 105, 176, 94, 14); rect(ctx, '#e98c330b', 95, 190, 114, 12)
    rect(ctx, '#6d4730', 138, 160, 30, 4); rect(ctx, '#b5753c', 141, 159, 24, 2)
    for (let i = 0; i < 5; i++) { const h = 9 + ((flame + i * 3) % 5) * 2; rect(ctx, '#db713b', 139 + i * 5, 160 - h, 5, h); rect(ctx, '#f4b750', 140 + i * 5, 160 - h + 5, 3, h - 5); rect(ctx, '#ffe1a1', 141 + i * 5, 157, 2, 3) }
    // Tea steam and a ticking pendulum.
    for (let i = 0; i < 3; i++) { const q = (t * 7 + i * 6) % 20; rect(ctx, '#fff0cb66', 347 + Math.round(Math.sin(q / 4)), 146 - q, 2, 3) }
    rect(ctx, '#d6b56c', 154 + Math.round(Math.sin(t * 3) * 3), 88, 2, 3)
    // Door opens only when the actual classroom task is available.
    if (mode === 'ready' || freeDoor || departing) {
      rect(ctx, '#7caaa0', 541, 91, 44, 77); rect(ctx, '#a0c0ad', 544, 94, 38, 34); rect(ctx, '#5e8975', 543, 128, 41, 40)
      rect(ctx, '#d6c192', 548, 155, 28, 13); rect(ctx, '#efda9d35', 533, 177, 65, 10); rect(ctx, '#efda9d20', 525, 187, 81, 10)
      block(ctx, 538, 90, 11, 78, '#886448'); rect(ctx, '#e2bb6e', 545, 134, 2, 3)
      const bob = Math.round(Math.sin(t * 3) * 2); rect(ctx, '#ffe3a5', 562, 113 + bob, 3, 15); rect(ctx, '#ffe3a5', 558, 116 + bob, 11, 3)
      rect(ctx, '#fff4c1', 474, 78, 3, 4); rect(ctx, '#fff4c1', 471, 81, 9, 2)
    } else {
      block(ctx, 541, 90, 44, 77, '#976f48'); block(ctx, 547, 97, 32, 26, '#826047'); block(ctx, 547, 130, 32, 30, '#826047'); rect(ctx, '#deb665', 575, 126, 3, 4)
    }
    // Floating dust, kept subtle and sparse.
    for (let i = 0; i < 10; i++) { const x = 205 + (i * 37) % 310; const y = 83 + ((i * 19 - t * 2) % 135 + 135) % 135; rect(ctx, i % 2 ? '#f2db9c55' : '#f2db9c28', x + Math.round(Math.sin(t / 3 + i) * 3), y, 1, 1) }
    // Warm edge light, without covering the character.
    rect(ctx, '#debc6b10', 543, 264, 46, 35)
    present(t)
  }
  function drawHero (t, ctx, px, py) {
    const walking = Math.hypot(actor.target - actor.x, actor.targetY - actor.y) > 1
    const bob = walking ? Math.floor(t * 9) % 2 : Math.floor(t * 1.4) % 2
    const x = Math.round(px) - 20; const y = Math.round(py) - 56 - bob
    rect(ctx, '#493b3455', x + 4, py - 1, 34, 5)
    const blink = t % 5.2 > 5.02
    ctx.save(); if (departing && actor.y < 193) ctx.globalAlpha = Math.max(0.12, (actor.y - 173) / 20); ctx.translate(actor.facing < 0 ? x + 40 : x, y); if (actor.facing < 0) ctx.scale(-1, 1)
    sprite.forEach((row, ry) => [...row].forEach((p, rx) => { if (!colors[p]) return; const step = walking && ry > 22 ? (rx < 10 ? 1 : -1) * (Math.floor(t * 9) % 2) : 0; rect(ctx, blink && p === 'E' ? colors.S : colors[p], rx * 2, ry * 2 + step, 2, 2) }))
    // Idle hand wave every few seconds.
    if (!walking && t % 9 > 7) { rect(ctx, '#f7d0ae', 34, 24 + (Math.floor(t * 5) % 2) * 2, 4, 6); rect(ctx, '#f3ead3', 32, 30, 4, 5) }
    ctx.restore()
  }
  function present (t) {
    const h = viewHeight
    display.imageSmoothingEnabled = false
    if (!portrait) {
      display.drawImage(canvas, 0, 0, 640, 360, 0, 0, 640, h)
      drawHero(t, display, actor.x, actor.y * h / 360)
      return
    }
    // Portrait is a rearranged room, not a cropped or stretched landscape scene.
    rect(display, '#342a26', 0, 0, 360, h)
    rect(display, '#b58e63', 12, 12, 336, 300)
    for (let y = 310; y < h - 10; y += 16) {
      rect(display, y % 32 ? '#a77c52' : '#9c714d', 12, y, 336, 15)
      for (let x = 12 + (y % 32 ? 42 : 0); x < 348; x += 84) rect(display, '#73533e', x, y, 1, 15)
    }
    for (const x of [8, 344]) { rect(display, '#51392e', x, 8, 8, h - 16); rect(display, '#95714c', x + 2, 10, 2, h - 20) }
    rect(display, '#614332', 8, 8, 344, 10); rect(display, '#c19760', 14, 18, 332, 3)
    rect(display, '#513b30', 12, 308, 336, 8)
    const copy = (sx, sy, w, hh, x, y) => display.drawImage(canvas, sx, sy, w, hh, x, y, w, hh)
    copy(242, 54, 145, 92, 30, 105)
    copy(438, 65, 78, 76, 231, 108)
    copy(108, 94, 92, 86, 35, 224)
    copy(531, 80, 66, 98, 272, 218)
    copy(250, 145, 140, 48, 36, h * 0.51)
    copy(197, 219, 226, 87, 90, h * 0.64)
    copy(48, 245, 119, 65, 28, h - 140)
    copy(444, 262, 65, 44, 245, Math.min(h * 0.72, h - 180))
    // Preserve the character's pixel proportions while mapping its walk into this room.
    const py = 310 + (actor.y - 175) / 45 * Math.max(50, h * 0.62 - 310)
    drawHero(t, display, 20 + actor.x * 0.51, py)
  }
  function fitRoom () {
    const r = viewport.getBoundingClientRect()
    portrait = r.height > r.width * 1.15
    viewport.width = portrait ? 360 : 640
    viewHeight = Math.max(240, Math.round(viewport.width * r.height / Math.max(1, r.width)))
    viewport.height = viewHeight
    const areas = portrait ? { fire: [35, 224, 92, 86], board: [231, 108, 78, 76], door: [272, 218, 66, 98], desk: [36, viewHeight * 0.51, 140, 48], map: [245, Math.min(viewHeight * 0.72, viewHeight - 180), 65, 44] } : { fire: [108, 94, 92, 86], board: [438, 65, 78, 76], door: [531, 80, 66, 98], desk: [250, 145, 140, 48], map: [444, 262, 65, 44] }
    for (const [name, [x, y, w, h]] of Object.entries(areas)) {
      const button = $(`[data-cabin="${name}"]`)
      Object.assign(button.style, { left: `${x / viewport.width * 100}%`, top: `${y / (portrait ? viewHeight : 360) * 100}%`, width: `${w / viewport.width * 100}%`, height: `${h / (portrait ? viewHeight : 360) * 100}%` })
    }
    paint(clock)
  }
  new ResizeObserver(fitRoom).observe(viewport)
  function tick (ms) {
    const dt = Math.min((ms - lastFrame) / 1000, 0.08)
    if (ms - lastFrame >= 50) {
      lastFrame = ms
      if (!document.hidden) {
        if (!still) {
          clock += dt
          if (!departing && !arriving && clock > nextVisit) { actor.target = mode === 'ready' ? [460, 502][visit++ % 2] : [226, 380, 285, 185][visit++ % 4]; nextVisit = clock + 7 }
          const dx = actor.target - actor.x; const dy = actor.targetY - actor.y; const distance = Math.hypot(dx, dy)
          if (distance > 1) {
            if (Math.abs(dx) > 1) actor.facing = Math.sign(dx)
            const step = Math.min(distance, dt * (departing ? 260 : arriving ? 85 : 24))
            actor.x += dx / distance * step; actor.y += dy / distance * step
          } else if (arriving) { arriving = false; nextVisit = clock + 4 }
          if (departing && distance < 2) { const done = departDone; departDone = null; done?.() }
        }
        paint(clock)
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  function say (text) { if ($('#cabin-speech').textContent !== text) $('#cabin-speech').textContent = text }
  function defaultSpeech () {
    if (!connected) return '暂时没有收到老师的消息。先在屋里等一会儿，连接恢复后我会告诉你。'
    if (mode === 'ready') return state.offeredTask ? '老师给你送来一项新任务，已经放在任务板上了。准备好就一起出发吧。' : state.result?.complete && state.next ? '这一项完成啦！下一项任务已经准备好，从门口出发吧。' : '老师发布任务啦！先看看任务板，准备好就从右边的门出发，我陪你一起去。'
    if (mode === 'gather') return '回来啦！代码留在原来的关卡里。我们先在小屋集合，一起听老师讲。'
    if (mode === 'ended') return '欢迎回家！完成的任务放进学习记录了。想继续练习，可以去地图桌选一关。'
    if (mode === 'paused') return '老师正在讲解，我们先歇一会儿。恢复练习后，就能继续刚才的任务。'
    return '欢迎回家！任务板看老师的安排，地图桌选练习，书桌里是你的记录和草稿。'
  }
  function update (value) {
    state = value; connected = true
    mode = state.status === 'ended' ? 'ended' : state.status !== 'live' ? 'waiting' : state.gathered ? 'gather' : state.paused ? 'paused' : 'ready'
    const key = [state.id, mode, state.task?.id, state.offeredTask?.id, !!state.result?.complete].join(':')
    if (key !== lastKey) { lastKey = key; say(defaultSpeech()); nextVisit = clock + 0.2; if (mode !== 'ready' && departing) { departDone?.(); departDone = null; departing = false; actor.target = 280; actor.targetY = 220 } }
    document.body.dataset.cabinState = mode
    $('#cabin-badge').textContent = { waiting: '在小屋 · 可以自由练习', gather: '老师召集 · 小屋集合', ready: '任务已发布 · 可以出发', paused: '一起看老师讲解', ended: '课堂结束 · 欢迎回来' }[mode]
    const door = $('.cabin-door'); door.disabled = mode !== 'ready'; door.querySelector('span').textContent = mode === 'ready' ? '出发 →' : mode === 'gather' ? '在小屋集合' : '等待任务'
  }
  function offline () { connected = false; mode = 'offline'; lastKey = ''; $('.cabin-door').disabled = true; $('#cabin-badge').textContent = '正在重新连接课堂'; say(defaultSpeech()) }
  document.querySelectorAll('[data-cabin]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.cabin === 'fire') { actor.target = 184; nextVisit = clock + 8; say('这里暖和吧？休息一下也没关系，任务来了我会叫你。') }
    if (button.dataset.cabin === 'desk') { actor.target = 321; nextVisit = clock + 8; window.lessonHub?.open('notebook') }
    if (button.dataset.cabin === 'board') window.lessonHub?.open('task')
    if (button.dataset.cabin === 'map') window.lessonHub?.open('map')
    if (button.dataset.cabin === 'door') doorAction?.()
  }))
  function motion () { $('#cabin-motion').textContent = still ? '开启小屋动画' : '暂停小屋动画'; $('#cabin-motion').setAttribute('aria-pressed', String(still)) }
  $('#cabin-motion').onclick = () => { still = !still; motion() }
  reduced.addEventListener('change', e => { still = e.matches; motion() }); motion()
  window.lessonCabin = {
    update,
    offline,
    navigation ({ enabled, selected, label, action }) {
      freeDoor = state?.status !== 'live' && selected
      doorAction = action
      const door = $('.cabin-door'); door.disabled = !enabled; door.querySelector('span').textContent = label
    },
    depart: () => new Promise(resolve => {
      if (still) return resolve()
      departing = true; arriving = false; actor.target = 564; actor.targetY = 174; say('准备好啦，一起出发！'); let done = false
      const finish = () => { if (!done) { done = true; resolve() } }
      departDone = finish
      // A hidden tab, a reduced-motion change, or a dropped frame must never trap navigation.
      setTimeout(finish, 1800)
    }),
  }
})()
