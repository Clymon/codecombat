// Local classroom autosave feedback. This never owns or replaces editor contents.
module.exports = class TeachingSaveStatus {
  constructor (document, retry) {
    this.document = document
    this.retry = retry
  }

  static recovery (error = {}) {
    const actions = {
      401: '登录已失效。请先复制代码到本地，在新标签页登录课程地图，然后重新进入本关并粘贴代码。',
      403: '此关当前不可提交。请先复制代码到本地，联系教师确认开放状态，再从课程地图重新进入。',
      404: '原会话已不存在。请先复制代码到本地，在新标签页打开课程地图，重新进入本关并粘贴代码。',
      409: '场景或关卡内容已更新。请先复制代码到本地，在新标签页打开课程地图，重新进入本关并粘贴代码。',
    }
    const action = actions[error.status]
    const detail = error.responseJSON?.message || error.message || ''
    const reason = /[\u3400-\u9fff]/.test(detail) ? detail + ' ' : ''
    return {
      retryable: !action,
      message: '保存失败，代码仍保留在当前编辑器中。' + (action ? reason + action : '请勿刷新或离开页面；可重试保存，持续失败请联系教师。'),
    }
  }

  failed (error) {
    const recovery = TeachingSaveStatus.recovery(error)
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
      this.recover = this.document.createElement('a')
      this.recover.setAttribute('data-teaching-save-recover', '')
      this.recover.href = '/teaching'
      this.recover.target = '_blank'
      this.recover.rel = 'noopener'
      this.recover.textContent = '复制代码后，在新标签页打开课程地图'
      this.notice.append(this.message, this.button, this.recover)
      this.document.body.appendChild(this.notice)
    }
    this.message.textContent = recovery.message
    this.button.hidden = !recovery.retryable
    this.button.style.display = recovery.retryable ? 'block' : 'none'
    this.recover.hidden = recovery.retryable
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
