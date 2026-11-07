// Local classroom autosave feedback. This never owns or replaces editor contents.
module.exports = class TeachingSaveStatus {
  constructor (document, retry) {
    this.document = document
    this.retry = retry
  }

  failed () {
    if (!this.notice) {
      this.notice = this.document.createElement('div')
      this.notice.setAttribute('data-teaching-save-notice', '')
      this.notice.setAttribute('role', 'alert')
      this.notice.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:11000;max-width:420px;padding:16px;background:#fff2da;color:#542400;border:2px solid #b65d00;border-radius:8px;font-size:16px;line-height:1.5'
      this.message = this.document.createElement('span')
      this.button = this.document.createElement('button')
      this.button.setAttribute('data-teaching-save-retry', '')
      this.button.textContent = '重试保存'
      this.button.style.cssText = 'display:block;margin-top:8px;padding:6px 16px'
      this.button.addEventListener('click', () => this.retry())
      this.notice.append(this.message, this.button)
      this.document.body.appendChild(this.notice)
    }
    this.message.textContent = '保存失败，代码仍保留在当前编辑器中。请勿刷新或离开页面；可重试保存，持续失败请联系教师。'
    this.button.disabled = false
  }

  saving () {
    if (!this.notice) return
    this.message.textContent = '正在重试保存，请保留当前页面和代码…'
    this.button.disabled = true
  }

  clear () {
    if (this.notice) this.notice.remove()
    this.notice = null
  }
}
