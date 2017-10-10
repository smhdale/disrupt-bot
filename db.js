const db = require('nedb')

/**
 * Database setup
 */

const dbPath = dbName => `data/${dbName}`
const dbUsers = new db({ filename: dbPath('users'), autoload: true })

// Compact database every hour
dbUsers.persistence.setAutocompactionInterval(3600000)

function checkProps (obj, propList) {
  for (let prop of propList) {
    if (!(prop in obj)) {
      return false
    }
  }
  return true
}

module.exports = {
  // User management

  getUser (fbid) {
    return new Promise((resolve, reject) => {
      dbUsers.findOne({ id: fbid }, (err, result) => {
        if (err === null) {
          resolve(result)
        } else {
          reject(err)
        }
      })
    })
  },

  addUser (payload) {
    let required = [ 'id', 'first_name', 'last_name', 'profile_pic' ]

    return new Promise((resolve, reject) => {
      // Check valid user format
      if (!checkProps(payload, required)) {
        reject('Invalid user account format')
      }
      dbUsers.insert(payload, err => {
        if (err === null) {
          resolve({ success: true })
        } else {
          reject(err)
        }
      })
    })
  }
}
