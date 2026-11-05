// A single choice per loading screen; ordinary rerenders keep the same image.
const art = [
  { id: 'gate', name: '地牢入口', src: '/teaching/assets/scenery/village-loading-gate-v2.jpg' },
  { id: 'bridge', name: '村口石桥', src: '/teaching/assets/scenery/village-loading-bridge-v1.jpg' },
  { id: 'workshop', name: '机关工坊', src: '/teaching/assets/scenery/village-loading-workshop-v1.jpg' },
  { id: 'camp', name: '夜间营地', src: '/teaching/assets/scenery/village-loading-camp-v1.jpg' },
]
const fallback = '/teaching/assets/scenery/village-loading-v1.png'
const storageKey = 'deepseek-loading-art-v2'
let previousInMemory

function chooseArt (previous, random = Math.random) {
  const choices = art.filter(image => image.id !== previous)
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))]
}

function selectLoadingArt () {
  let previous = previousInMemory
  try { previous = sessionStorage.getItem(storageKey) || previous } catch (_) {}
  const selected = chooseArt(previous)
  previousInMemory = selected.id
  try { sessionStorage.setItem(storageKey, selected.id) } catch (_) {}
  return selected
}

function bindArtFallback (image) {
  if (!image) return () => {}
  let attemptedFallback = image.getAttribute('src') === fallback
  const onError = () => {
    if (attemptedFallback) { image.style.visibility = 'hidden'; return }
    attemptedFallback = true
    image.src = fallback
  }
  image.addEventListener('error', onError)
  return () => image.removeEventListener('error', onError)
}
module.exports = { art, fallback, chooseArt, selectLoadingArt, bindArtFallback, storageKey }
