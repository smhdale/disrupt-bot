const FPS = 60

// Inclusive
function randInt(min, max) {
  return Math.floor(Math.random * (max - min + 1)) + min
}

// Disrupt message

class DisruptedText {
  constructor (string, animTime) {
    this.frame = 0
    this.string = string
    this.chars = []
    this.scrambleSpd = FPS * 0.1

    this.obfuscatedChars = '!@#$%^&*123456789'

    for (let char of string) {
      let showTime = randInt(0, animTime / 2)
      let stopTime = randInt(animTime - showTime, animTime)
      this.chars.push({
        current: ' ',
        target: char,
        showTime: showTime,
        stopTime: stopTime
      })
    }
  }

  getRandomChar () {
    return this.obfuscatedChars[randInt(0, this.obfuscatedChars.length - 1)]
  }

  update () {
    for (let char of this.chars) {
      // Don't animate spaces
      if (char.target !== ' ') {
        if (char.showTime >= this.frame && this.frame < char.stopTime) {
          // Obfuscate chars
          if (this.frame % this.scrambleSpd === 0) {
            this.current = this.getRandomChar()
          }
        } else if (this.frame >= char.stopTime && this.current !== this.target) {
          this.current = this.target
        }
      }
    }
  }

  get value () {
    return this.chars.reduce((acc, char) => return acc + char.current, '')
  }
}

class DisruptMessage {
  constructor (picUrl, name, message) {
    this.picUrl = picUrl

    this.name = name
    this.message = message
    this.obfuscatedName = new DisruptedText(name)
    this.obfuscatedMessage = new DisruptedText()

    this.elem = document.createElement('div')
    this.profilePic = new Image()
    this.animFrame = 0

    this.init()
  }

  async init () {
    await this.setProfilePic()
    this.animateIn()
  }

  initDom () {
    this.elem.innerHTML = `<div class="profile-pic"></div>
    <div class="message-details">
      <p class="user-name"></p>
      <p class="user-message"></p>
    </div>`

    // Add profile pic
    this.elem.querySelector('.profile-pic').apapendChild(this.profilePic)
  }

  setProfilePic () {
    return new Promise((resolve, reject) => {
      this.profilePic.onload = resolve
      this.profilePic.onerror = reject
      this.profilePic.src = this.picUrl
    })
  }

  udpate () {
    // Animate the text in somehow, probably letter by letter
    let progress = this.animFrame / this.animTime

  }
}

class MessageHandler {
  constructor () {
    this.messages = []
  }

  get numMessages () {
    return this.messages.length
  }

  addMessage (data) {
    // Create a DisruptMessage
    this.messages.push(new DisruptMessage(
      data.image,
      data.name,
      data.message
    ))
  }

  updateMessages () {
    if (this.numMessages > 0) {
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

const FIFO = new MessageQueue()

// MAIN LOOP

function MainLoop () {


  window.requestAnimationFrame(MainLoop)
}

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
