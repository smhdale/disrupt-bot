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
    console.dir(this.queue)
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
