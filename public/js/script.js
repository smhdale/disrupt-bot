const FPS = 60
const secToFPS = sec => Math.floor(sec * FPS)

const EFFECT_SPD = 1000
const MOVE_SPD = 2000

// Inclusive
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Disrupt message

class DisruptedText {
  constructor (string, animTime) {
    this.frame = 0
    this.string = string
    this.chars = []
    this.scrambleSpd = secToFPS(0.1)

    this.obfuscatedChars = '!@#$%^&*123456789'

    for (let char of string) {
      let showFrame = randInt(0, animTime * 0.75)
      let stopFrame = randInt(animTime - showFrame, animTime)
      this.chars.push({
        current: ' ',
        target: char,
        showFrame: showFrame,
        stopFrame: stopFrame
      })
    }
  }

  getRandomChar () {
    return this.obfuscatedChars[randInt(0, this.obfuscatedChars.length - 1)]
  }

  update () {
    let didUpdate = false

    for (let char of this.chars) {
      // Don't animate spaces
      if (char.target !== ' ') {
        if (this.frame >= char.showFrame && this.frame < char.stopFrame) {
          // Obfuscate chars
          if (this.frame % this.scrambleSpd === 0) {
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
    return didUpdate
  }

  get value () {
    return this.chars.reduce((acc, char) => acc + char.current, '')
  }
}

class DisruptMessage {
  constructor (target, picUrl, name, message) {
    this.target = document.querySelector(target)

    this.picUrl = picUrl
    this.name = name
    this.message = message

    let animTime = secToFPS(2)
    this.obfuscatedName = new DisruptedText(name, animTime)
    this.obfuscatedMessage = new DisruptedText(message, animTime)

    this.elem = null
    this.profilePic = new Image()

    this.animateText = false
    this.inForeground = true

    this.bounds = {
      w: window.innerWidth,
      h: window.innerHeight * 0.85 // Account for contact bar
    }

    this.x = this.bounds.w / 2
    this.y = this.bounds.h / 2

    this.xPrev = -1
    this.yPrev = -1

    this.init()
  }

  async init () {
    this.initDom()
    await this.setProfilePic()
    this.setupTriggers()
  }

  setupTriggers() {
    // Fade in
    window.setTimeout(() => {
      this.elem.classList.remove('hidden')
    }, 1)

    // Expand
    window.setTimeout(() => {
      this.elem.classList.remove('pic-only')
      this.animateText = true
    }, EFFECT_SPD)

    // Move to side
    window.setTimeout(() => {
      this.elem.classList.add('secondary')
    }, EFFECT_SPD + 5000)

    // Allow new messages
    window.setTimeout(() => {
      this.inForeground = false
    }, EFFECT_SPD + 5000 + MOVE_SPD)
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

  moveToBackground () {
    // Send the message somewhere in the background


    // Give another second before allowing another message to appear
    window.setTimeout(this.markFinishedDisplaying.bind(this), 1000)
  }

  markFinishedDisplaying () {
    this.inForeground = false
  }
}

class MessageHandler {
  constructor () {
    this.messages = []
  }

  get numMessages () { return this.messages.length }
  get hasMessages () { return this.numMessages > 0 }

  get messageAnimating () {
    if (!this.hasMessages) {
      return false
    }
    return this.messages.reduce((acc, msg) => acc || msg.inForeground, false)
  }

  addMessage (data) {
    // Notify current message to move to background
    if (this.hasMessages) {
      console.dir(this.messages[this.numMessages - 1])
      this.messages[this.numMessages - 1].moveToBackground()
    }

    // Create a DisruptMessage
    this.messages.push(new DisruptMessage(
      '#messages',
      data.image,
      data.name,
      data.message
    ))
  }

  updateMessages () {
    if (this.hasMessages) {
      for (let message of this.messages) {
        message.update()
      }
    }
  }
}

// Message queue

class MessageQueue {
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

const MESSAGES = new MessageHandler()
const FIFO = new MessageQueue()

// MAIN LOOP

function MainLoop () {
  // Check if queue is non-empty and there's no currently animating message
  if (!MESSAGES.messageAnimating && !FIFO.isEmpty) {
    let next = FIFO.pop()
    MESSAGES.addMessage(next)
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
  FIFO.push(data)
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
