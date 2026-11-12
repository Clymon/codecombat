// Browser-local recovery only: never marks a task complete or overwrites editor contents.
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.CabinDrafts = factory()
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const key = id => /^\d{4,20}$/.test(id || '') ? 'classroom-cabin-drafts-v1:' + id : null
  function stores (host) { const result = []; for (const name of ['localStorage', 'sessionStorage']) { try { if (host[name]) result.push(host[name]) } catch (_) {} } return result }
  function all (storage, id) { try { return JSON.parse(storage.getItem(key(id)) || '{}') || {} } catch (_) { return {} } }
  function list (host, id) {
    if (!key(id)) return []
    const merged = {}
    for (const storage of stores(host)) {
      for (const [slug, d] of Object.entries(all(storage, id))) {
        if (!/^local-python-\d{2}$/.test(slug) || typeof d?.code !== 'string' || !Number.isFinite(d.savedAt)) continue
        if (!merged[slug] || merged[slug].savedAt < d.savedAt) merged[slug] = { ...d, slug }
      }
    }
    return Object.values(merged).sort((a, b) => b.savedAt - a.savedAt)
  }
  function read (host, id, slug) { return list(host, id).find(d => d.slug === slug) }
  function save (host, id, slug, code) {
    if (!key(id) || !/^local-python-\d{2}$/.test(slug)) return null
    const draft = { slug, code, savedAt: Date.now() }
    for (const storage of stores(host)) { try { const data = all(storage, id); data[slug] = draft; storage.setItem(key(id), JSON.stringify(data)); return draft } catch (_) {} }
    return null
  }
  function remove (host, id, slug, savedAt) {
    if (!key(id) || !savedAt) return
    for (const storage of stores(host)) { try { const data = all(storage, id); if (data[slug]?.savedAt === savedAt) { delete data[slug]; storage.setItem(key(id), JSON.stringify(data)) } } catch (_) {} }
  }
  return { list, read, save, remove }
})
