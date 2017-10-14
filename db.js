const db = require('nedb')
const paths = require('./paths')

/**
 * Database setup
 */

const dbUsers = new db({ filename: paths.db('users'), autoload: true })

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

function updateUser (user, updates) {
  return new Promise((resolve, reject) => {
    dbUsers.update({ id: user.id }, { $set: updates }, (err, numUpdated) => {
      if (err !== null) {
        reject(err)
      } else {
        resolve(numUpdated)
      }
    })
  })
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
  },

  // Marks the current user as having been greeted for a given date
  markGreetedOn (user, dateString) {
    return updateUser(user, { greeted_on: dateString })
  }
}
