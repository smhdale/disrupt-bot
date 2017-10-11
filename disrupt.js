const Canvas = require('canvas')
const Image = Canvas.Image
const GIFEncoder = require('gifencoder')
const fs = require('fs')

const db = require('./db')
const paths = require('./paths')

/**
 * Handle processing of disrupted images and text
 */

function disrupt (canvas) {
  let ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'

  // Just draw a rectangle to prove that we can
  let side = canvas.width / 2
  let x = (canvas.width - side) / 2
  let y = (canvas.height - side) / 2
  ctx.fillRect(x, y, side, side)

  return canvas
}

function disruptText (text) {

}

function getProfilePic (fbid) {
  let image = new Image()

  return new Promise((resolve, reject) => {
    fs.readFile(paths.image(`${fbid}.jpg`), (err, buffer) => {
      if (err) {
        reject(err)
      } else {
        image.onload = () => {
          resolve(image)
        }
        image.onerror = reject
        image.src = buffer
      }
    })
  })
}

const sin = x => .5 * Math.sin(2 * Math.PI * x)

function disruptImage (image, outputFile) {
  let gifSize = 300

  // Make canvas
  let canvas = new Canvas(gifSize, gifSize)
  let ctx = canvas.getContext('2d')

  // Create animated GIF
  let filename = outputFile + '.gif'
  let filepath = paths.image(filename)
  let encoder = new GIFEncoder(gifSize, gifSize)
  let stream = fs.createWriteStream(filepath)
  encoder.createReadStream().pipe(stream)
  encoder.start()
  encoder.setRepeat(0)
  encoder.setDelay(33)

  // Do animation
  let amp = 10
  let rows = 30
  let rowMod = 10
  let rowSrcH = image.height / rows
  let rowH = gifSize / rows
  let frames = 30
  for (let i = 0; i < frames; i++) {
    ctx.clearRect(0, 0, gifSize, gifSize)
    for (let row = 0; row < rows; row++) {
      let rowPos = (row % rowMod) / rowMod
      let dx = amp * sin(rowPos + i / frames)
      ctx.drawImage(image,
        0, row * rowSrcH, image.width, rowSrcH,
        dx, row * rowH, gifSize, rowH
      )
    }
    encoder.addFrame(ctx)
  }
  encoder.finish()

  // Save gif, return file path
  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      resolve(filename)
    })
    stream.on('error', reject)
  })
}

/**
 * Module public functions
 */

module.exports = {
  disruptImage (fbid) {
    return getProfilePic(fbid).then(image => {
      return disruptImage(image, `${fbid}_disrupted`)
    })
  }
}
