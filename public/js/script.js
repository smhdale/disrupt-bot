const FPS = 60
const secToFPS = sec => Math.floor(sec * FPS)
const ANIM_SPEED = 1000

// Inclusive
function randInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Exponential tween
function exponent (x) {
	return Math.pow(2, 10 * (x - 1))
}

// Disrupt message

class DisruptedText {
  constructor (string, animTime, useExponent = false) {
    this.frame = 0
    this.string = string
    this.chars = []
    this.scrambleSpd = secToFPS(0.1)
    this.exponential = useExponent

    this.obfuscatedChars = 'abcdefghijklmnopqrstuvqxyz1234567890'

    for (let char of string) {
      let showFrame = randInt(0, animTime * 0.3)
      let stopFrame

      if (this.useExponent) {
        // Exponential effect trail off
        let pct = exponent(Math.random())
        stopFrame = pct * Math.floor(animTime - showFrame) + showFrame
      } else {
        stopFrame = randInt(animTime - showFrame, showFrame)
      }

      this.chars.push({
        current: ' ',
        target: char,
        showFrame: showFrame,
        stopFrame: stopFrame,
        phaseOffset: randInt(0, this.scrambleSpd - 1)
      })
    }
  }

  getRandomChar () {
    let char = randInt(0, this.obfuscatedChars.length - 1)
    return this.obfuscatedChars[char]
  }

  update () {
    let didUpdate = false

    for (let char of this.chars) {
      // Don't animate spaces
      if (char.target !== ' ') {
        if (this.frame >= char.showFrame && this.frame < char.stopFrame) {
          // Obfuscate chars
          if ((this.frame + char.phaseOffset) % Math.floor(this.scrambleSpd) === 0) {
            char.current = this.getRandomChar()
            didUpdate = true
          }
        } else if (this.frame >= char.stopFrame && char.current !== char.target) {
          char.current = char.target
          didUpdate = true
        }
      }
    }

    this.frame++
    this.scrambleSpd += 1 / FPS
    return didUpdate
  }

  get value () {
    return this.chars.reduce((acc, char) => acc + char.current, '')
  }
}

class DisruptMessage {
  constructor (target, picUrl, name, message, hideImmediately = false) {
    this.target = document.querySelector(target)

    this.picUrl = picUrl
    this.name = name
    this.message = message

    this.obfuscatedName = new DisruptedText(name, secToFPS(1))
    this.obfuscatedMessage = new DisruptedText(message, secToFPS(3), message.length > 25)

    this.elem = null
    this.profilePic = new Image()

    this.animateText = false
    this.animating = true
    this.inForeground = true
    this.timeInForeground = 6000
    this.hideImmediately = hideImmediately

    this.bounds = {
      w: window.innerWidth,
      h: window.innerHeight * 0.85 // Account for contact bar
    }

    this.x = this.bounds.w / 2
    this.y = this.bounds.h / 2

    this.xPrev = -1
    this.yPrev = -1

    this.first = false

    this.init()
  }

  async init () {
    this.initDom()
    await this.setProfilePic()
    this.setupTriggers()
  }

  markAsFirst () {
    this.first = true
  }

  setupTriggers() {
    // Fade in
    window.setTimeout(() => {
      this.elem.classList.remove('hidden')
    }, 1)

    // Expand
    window.setTimeout(() => {
      this.elem.classList.remove('pic-only')
    }, ANIM_SPEED)

    // Show text
    window.setTimeout(() => {
      this.animateText = true
    }, ANIM_SPEED * 1.2)

    // Move to side
    window.setTimeout(() => {
      if (!this.first) {
        this.elem.classList.add('second-position')
      }

      if (this.hideImmediately) {
        this.moveOffScreen()
      } else {
        this.inForeground = false
        MESSAGE_LIST.unhide()
      }
    }, ANIM_SPEED + this.timeInForeground)
  }

  initDom () {
    this.elem = document.createElement('div')
    this.elem.className = 'message pic-only hidden'

    this.elem.innerHTML = `<div class="profile-pic"></div>
    <div class="message-details">
      <p class="user-name"></p>
      <p class="user-message"></p>
    </div>`

    // Add profile pic
    this.elem.querySelector('.profile-pic').appendChild(this.profilePic)

    // Add to messages
    this.target.appendChild(this.elem)
  }

  setProfilePic () {
    return new Promise((resolve, reject) => {
      this.profilePic.onload = resolve
      this.profilePic.onerror = resolve
      this.profilePic.src = this.picUrl
    })
  }

  setInnerHTML (text, sel) {
    let node = document.createTextNode(text)
    let target = this.elem.querySelector(sel)
    target.innerHTML = ''
    target.appendChild(node)
  }

  deleteFromParent () {
    // Delete from current parent
    this.elem.parentElement.removeChild(this.elem)
  }

  moveElement (sel) {
    this.deleteFromParent()

    // Add to new parent
    let newTarget = document.querySelector(sel)
    if (newTarget.firstChild !== null) {
      newTarget.insertBefore(this.elem, newTarget.firstChild)
    } else {
      newTarget.appendChild(this.elem)
    }
  }

  update () {
    if (this.animateText) {
      if (this.obfuscatedName.update()) {
        this.setInnerHTML(this.obfuscatedName.value, '.user-name')
      }
      if (this.obfuscatedMessage.update()) {
        this.setInnerHTML(this.obfuscatedMessage.value, '.user-message')
      }
    }
  }

  triggerMoveOffScreen () {
    if (!this.elem.classList.contains('third-position')) {
      this.moveOffScreen()
    }
  }

  moveOffScreen () {
    // Send the message somewhere in the background
    if (!this.elem.classList.contains('second-position')) {
      this.elem.classList.add('second-position')
    }
    this.elem.classList.add('third-position')

    // Hide message list
    MESSAGE_LIST.hide()

    // Give another second before allowing another message to appear
    window.setTimeout(this.markFinishedAnimating.bind(this), 1000)

    // Allow for message list to disappear before moving to it
    window.setTimeout(() => {
      this.moveElement('#message-list')
      // Tell message list to remove old elements
      MESSAGES.removeOldMessages()
    }, 2500)
  }

  markFinishedAnimating () {
    this.animating = false
  }
}

class MessageHandler {
  constructor () {
    this.messages = []
    this.maxMessages = 7
  }

  get numMessages () { return this.messages.length }
  get hasMessages () { return this.numMessages > 0 }

  get messageAnimating () {
    if (!this.hasMessages) {
      return false
    }
    return this.messages[0].animating
  }

  hideCurrent () {
    if (this.hasMessages) {
      let current = this.messages[0]
      if (current.inForeground && !current.hideImmediately) {
        current.hideImmediately = true
      } else if (!current.inForeground) {
        current.triggerMoveOffScreen()
      }
    }
  }

  addMessage (data) {
    // Create a DisruptMessage
    let message = new DisruptMessage(
      '#main-message',
      data.image,
      data.name,
      data.message
    )

    if (this.numMessages === 0) {
      message.markAsFirst()
      this.messages.push(message)
    } else {
      this.messages = [
        message,
        ...this.messages
      ]
    }
  }

  updateMessages () {
    if (this.hasMessages) {
      for (let message of this.messages) {
        message.update()
      }
    }
  }

  removeOldMessages () {
    // Remove DOM elements
    for (let message of this.messages.filter((_, i) => i >= this.maxMessages)) {
      message.deleteFromParent()
    }

    // Remove old elems
    this.messages = this.messages.filter((_, i) => i < this.maxMessages)
  }
}

// Message queue

class FIFO {
  constructor () {
    this.queue = []
  }

  get isEmpty () {
    return this.queue.length === 0
  }

  // Add an item to the end of the queue
  push (item) {
    this.queue.push(item)
  }

  // Returns the next item in the queue, then removes it
  // Returns null if queue is empty
  pop () {
    if (this.isEmpty) {
      return null
    }

    let item = this.queue[0]
    this.queue = this.queue.filter((_, i) => i > 0)
    return item
  }
}

class MessageList {
  constructor () {
    this.elem = document.querySelector('#message-list')
    this.hideClass = 'hide'
  }
  hide () { this.elem.classList.add(this.hideClass) }
  unhide () { this.elem.classList.remove(this.hideClass) }
}

const MESSAGE_LIST = new MessageList()
const MESSAGES = new MessageHandler()
const MESSAGE_QUEUE = new FIFO()

// MAIN LOOP

function MainLoop () {
  // Check for new messages in the queue
  if (!MESSAGE_QUEUE.isEmpty) {
    if (MESSAGES.messageAnimating) {
      // Tell the current message to go away
      MESSAGES.hideCurrent()
    } else {
      // Wait until current message is finished
      let next = MESSAGE_QUEUE.pop()
      MESSAGES.addMessage(next)
    }
  }

  MESSAGES.updateMessages()

  window.requestAnimationFrame(MainLoop)
}

// Start anim on window ready
window.addEventListener('load', () => {
  window.requestAnimationFrame(MainLoop)
})

// PUSHER

function handleMessage (data) {
  MESSAGE_QUEUE.push(data)
}

class PusherInstance {
  constructor () {
    this._key = '7dced3ef5a883a029dd6'
    this._options = {
      cluster: 'ap1',
      encrypted: true
    }

    this._instance = new Pusher(this._key, this._options)
    this._subscriptions = {}
  }

  // Subscribe to a channel
  subscribe (channelName) {
    let channel = this._instance.subscribe(channelName)
    this._subscriptions[channelName] = channel
    return new Promise((resolve, reject) => {
      channel.bind('pusher:subscription_succeeded', resolve)
      channel.bind('pusher:subscription_failed', reject)
    })
  }

  bindEvent (channelName, eventName, callback) {
    if (this._subscriptions.hasOwnProperty(channelName)) {
      this._subscriptions[channelName].bind(eventName, callback)
    }
  }
}

const PUSHER = new PusherInstance()
PUSHER.subscribe('messages').then(() => {
  PUSHER.bindEvent('messages', 'new-message', handleMessage)
}).catch(e => {
  console.error(`Failed to subscribe to channel: ${e}`)
})
