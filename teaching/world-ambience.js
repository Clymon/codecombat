// Decorative landmarks use percentages of the same 3:2 illustration as the nodes.
// No navigation, physics or progress state belongs in this layer.
function renderAmbience () {
  const fire = (kind, x, y, delay) => `<span class="ambient-fire ${kind}" style="left:${x}%;top:${y}%;--delay:${delay}s"><i class="ambient-fire-light"></i><svg viewBox="0 0 32 48"><path class="flame-outer" d="M16 47C-2 44 0 30 8 21c-1 9 5 6 4 0C10 12 19 8 19 0c11 14 3 20 8 25 8 10 5 22-11 22Z" fill="#ff9d35"/><path class="flame-inner" d="M16 45c-10-2-8-11-2-17 4-5 3-9 4-12 8 12 13 25-2 29Z" fill="#ffe4a0"/></svg></span>`
  return `<div class="world-ambience" aria-hidden="true">
    <div class="ambient-cloud"></div>
    <span class="ambient-npc" style="left:10.8%;top:64%"><i class="ambient-foot-shadow"></i><img src="/teaching/assets/characters/liang-wenfeng.png" alt="" draggable="false"></span>
    ${fire('forge-fire', 86.4, 22.8, -0.7)}${fire('camp-fire', 86.9, 79.4, -1.9)}
    <i class="ambient-lantern" style="left:83.2%;top:19.9%;--delay:-1s"></i>
    <i class="ambient-lantern" style="left:66.8%;top:63.8%;--delay:-2.5s"></i>
    <i class="ambient-beacon" style="left:90.9%;top:44.8%"></i>
    <span class="ambient-smoke" style="left:87.8%;top:8.8%"><i></i><i></i><i></i></span>
    <span class="ambient-butterfly" style="left:37.7%;top:27.2%;--delay:-3s"><i></i><b></b></span>
    <span class="ambient-butterfly butterfly-gold" style="left:16.5%;top:21%;--delay:-10s"><i></i><b></b></span>
    <i class="ambient-water-glint" style="left:46.5%;top:35%;--delay:-1s"></i>
    <i class="ambient-water-glint" style="left:53%;top:62%;--delay:-4s"></i>
    <i class="ambient-water-glint" style="left:56.7%;top:91%;--delay:-6s"></i>
  </div>`
}
module.exports = { renderAmbience }
